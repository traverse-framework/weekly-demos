//! model-execute-native-host <demo-root> <scenarios.json>
//! Runs the catalog `model/model.execute@1.0.0` WASM through crates.io traverse-runtime 0.15.0
//! `WasmExecutor::run_bytes_with_mediated_connectors` (wasmtime). The activated
//! `traverse.model-runtime@2.3.0` connector is a thin bridge onto the SAME crate's Spec 138
//! `ExactModelHostConnector` (signature + digest + rights + usage + status checks, wasmtime engine).
//! The bridge is the only host-written code: Spec 104 MediatedConnector -> Spec 137 HostConnectorPort.
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use traverse_contracts::ConnectorRequirement;
use traverse_runtime::exact_model::{ExactModelHostConnector, ExactModelPin, ExecutionPolicy, ModelUsage, PackageStatusEntry, TrustedModelKeys, model_signing_key_id};
use traverse_runtime::executor::{ActivatedConnector, ConnectorInvokeRequest, ConnectorInvokeResponse, MediatedConnector, MediatedConnectorContext, WasmExecutor};
use traverse_runtime::host_connector_dispatch::{HostConnectorHostRequest, HostConnectorPort};

fn hexs(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }
fn unhex32(s: &str) -> [u8; 32] { let mut o = [0u8; 32]; for i in 0..32 { o[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap(); } o }

struct Pkg { manifest: Vec<u8>, wasm: Vec<u8>, sig: Vec<u8> }
struct Bridge {
    pin: ExactModelPin, keys: Vec<(String, [u8; 32])>, pkg: Arc<Pkg>, status: Vec<(String, PackageStatusEntry)>,
    hosts: Mutex<HashMap<String, Result<ExactModelHostConnector, Value>>>,
    staged: Mutex<HashMap<String, Vec<u8>>>, outputs: Mutex<HashMap<String, Vec<u8>>>, runs: Mutex<u32>,
}
fn err(reason: &str, cls: &str) -> ConnectorInvokeResponse {
    ConnectorInvokeResponse { abi_version: "1.0.0".into(), result_class: cls.into(), payload: json!({"status":"error","reason":reason}) }
}
impl Bridge {
    fn host_for(&self, usage: &str, signers: &[String]) -> String {
        let mut s = signers.to_vec(); s.sort(); let key = format!("{usage}|{}", s.join(","));
        let mut hosts = self.hosts.lock().unwrap();
        if !hosts.contains_key(&key) {
            let mut tk = TrustedModelKeys::new();
            for (id, k) in &self.keys { if signers.contains(id) { tk.trust(k).unwrap(); } }
            let mut h = ExactModelHostConnector::new(vec![self.pin.clone()], tk);
            h.model_usage = match usage { "commercial" => Some(ModelUsage::Commercial), "non_commercial" => Some(ModelUsage::NonCommercial), _ => None };
            h.policies.insert("policy:default-wasm-cpu".into(), ExecutionPolicy { policy_ref: "policy:default-wasm-cpu".into(),
                allowed_classifications: vec!["public".into(), "internal".into()], max_output_bytes: 56, placements: vec![], require_fuel_metering: false });
            let r = h.register_package(&self.pkg.manifest, self.pkg.wasm.clone(), &self.pkg.sig);
            let entry = match r { Ok(_) => { if !self.status.is_empty() { h.set_package_status(self.status.iter().map(|(d, e)| (d.clone(), e.clone()))); } Ok(h) }
                Err(e) => Err(serde_json::to_value(&e).unwrap()) };
            hosts.insert(key.clone(), entry);
        }
        key
    }
}
impl MediatedConnector for Bridge {
    fn invoke(&self, req: &ConnectorInvokeRequest) -> Result<ConnectorInvokeResponse, String> {
        if req.operation != "model.execute" { return Ok(err("invalid_request", "model_unavailable")); }
        let p = &req.payload;
        let signers: Vec<String> = p["trust_root"]["allowed_signers"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default();
        let key = self.host_for(p["model_usage"].as_str().unwrap_or(""), &signers);
        let mut hosts = self.hosts.lock().unwrap();
        let h = match hosts.get_mut(&key).unwrap() { Ok(h) => h, Err(e) => {
            return Ok(err(e["reason"].as_str().unwrap_or("model_unavailable"), e["code"].as_str().unwrap_or("model_unavailable"))); } };
        let Some(frame) = self.staged.lock().unwrap().get(p["input_ref"].as_str().unwrap_or("")).cloned() else { return Ok(err("invalid_request", "model_unavailable")); };
        let in_ref = h.io.stage_model_input(&frame, 3160).map_err(|e| e.message)?;
        let mut payload = p.clone(); let o = payload.as_object_mut().unwrap();
        o.remove("model_usage"); o.remove("trust_root"); o.insert("input_ref".into(), json!(in_ref));
        if let Some(d) = o.get("model_ref").and_then(|m| m["digest"].as_str()).map(|d| d.trim_start_matches("sha256:").to_string()) { o.get_mut("model_ref").unwrap()["digest"] = json!(d); }
        let hreq = HostConnectorHostRequest { connector_id: req.connector_id.clone(), operation: req.operation.clone(), binding_id: "local-model-runtime".into(),
            target_family: "local".into(), correlation_id: "corr-native".into(), payload, cancel_requested: false };
        match h.invoke(&hreq) {
            Ok(r) => {
                let rv = serde_json::to_value(&r).unwrap();
                let art = rv["artifact_ref"].as_str().unwrap_or("").to_string();
                let bytes = h.io.read_model_output(&art, 56).map_err(|e| e.message)?;
                let mut n = self.runs.lock().unwrap(); *n += 1; let out_ref = format!("host:output:{n}");
                self.outputs.lock().unwrap().insert(out_ref.clone(), bytes);
                let ev = &rv["model_evidence"];
                let placement = rv["placement_evidence"]["placement"].as_str().unwrap_or("wasm-cpu").to_string();
                Ok(ConnectorInvokeResponse { abi_version: "1.0.0".into(), result_class: "ok".into(), payload: json!({
                    "status":"ok","output_ref":out_ref,"output_schema_ref":"schema:mnist-12-logits-f32",
                    "model_ref":{"model_id":self.pin.model_id,"version":self.pin.version,"digest":format!("sha256:{}", self.pin.digest.trim_start_matches("sha256:"))},
                    "placement":placement,"result_class":"ok",
                    "model_evidence":{"license_id":ev["rights"]["license_id"],"commercial_use":ev["rights"]["commercial_use"],"derivation":ev["rights"]["derivation"]["kind"],"effective_usage":ev["effective_usage"],"status":ev["status"]}}) })
            }
            Err(e) => { let v = serde_json::to_value(&e).unwrap(); Ok(err(v["reason"].as_str().unwrap_or("model_unavailable"), v["code"].as_str().unwrap_or("model_unavailable"))) }
        }
    }
}
fn main() {
    let a: Vec<String> = std::env::args().collect(); let root = std::path::PathBuf::from(&a[1]);
    let rd = |p: &str| std::fs::read(root.join(p)).unwrap_or_else(|_| panic!("read {p}"));
    let scen: Value = serde_json::from_slice(&std::fs::read(&a[2]).unwrap()).unwrap();
    let cap = rd("capability/model-execute-agent.wasm"); let cap_digest = hexs(&Sha256::digest(&cap));
    let contract: Value = serde_json::from_slice(&rd("capability/contract.json")).unwrap();
    let declared: Vec<ConnectorRequirement> = serde_json::from_value(contract["connector_requirements"].clone()).unwrap();
    let deps: Value = serde_json::from_slice(&rd("package/app.model-deps.json")).unwrap();
    let pin: ExactModelPin = serde_json::from_value(deps["exact_model_dependencies"][0].clone()).unwrap();
    let k1 = unhex32(String::from_utf8(rd("package/trusted-public-key.hex")).unwrap().trim());
    let upj: Value = serde_json::from_slice(&rd("fixtures/digits-onnx-1.0.0-upstream/upstream-test-signing-key.public.json")).unwrap();
    let k2 = unhex32(upj["public_key_hex"].as_str().unwrap());
    let keys = vec![(model_signing_key_id(&k1), k1), (model_signing_key_id(&k2), k2)];
    let base = Pkg { manifest: rd("package/mnist-12-1.0.0/model.manifest.json"), wasm: rd("package/mnist-12-1.0.0/model.wasm"), sig: rd("package/mnist-12-1.0.0/model.sig.json") };
    let mut tw = base.wasm.clone(); let l = tw.len(); tw[l - 1000] ^= 1;
    let mk = |pkg: Pkg, status: Vec<(String, PackageStatusEntry)>| Arc::new(Bridge { pin: pin.clone(), keys: keys.clone(), pkg: Arc::new(pkg), status,
        hosts: Mutex::new(HashMap::new()), staged: Mutex::new(HashMap::new()), outputs: Mutex::new(HashMap::new()), runs: Mutex::new(0) });
    let normal = mk(Pkg { manifest: base.manifest.clone(), wasm: base.wasm.clone(), sig: base.sig.clone() }, vec![]);
    let tamper = mk(Pkg { manifest: base.manifest.clone(), wasm: tw, sig: base.sig.clone() }, vec![]);
    let revoke_entry: PackageStatusEntry = serde_json::from_value(json!({"status":"revoked","reason":"demo: revoked by host"})).unwrap();
    let revoke = mk(Pkg { manifest: base.manifest.clone(), wasm: base.wasm.clone(), sig: base.sig.clone() }, vec![(pin.digest.clone(), revoke_entry)]);
    let exec = WasmExecutor::new().expect("executor");
    let mut results = vec![];
    for s in scen.as_array().unwrap() {
        let b = match s["variant"].as_str().unwrap() { "tamper" => tamper.clone(), "revoke" => revoke.clone(), _ => normal.clone() };
        let input = &s["input"];
        let frame = rd(&format!("fixtures/{}.frame.bin", s["frame"].as_str().unwrap()));
        b.staged.lock().unwrap().insert(input["input_ref"].as_str().unwrap().to_string(), frame);
        let before = *b.runs.lock().unwrap();
        let t = std::time::Instant::now();
        let r = if s["bind"].as_bool().unwrap() {
            let ctx = MediatedConnectorContext { declared_requirements: declared.clone(), activated_connectors: vec![ActivatedConnector {
                connector_id: "traverse.model-runtime".into(), version: "2.3.0".into(), implementation: b.clone() }] };
            exec.run_bytes_with_mediated_connectors(&cap, input, "model.execute", ctx)
        } else { exec.run_bytes_with_mediated_connectors(&cap, input, "model.execute", MediatedConnectorContext { declared_requirements: declared.clone(), activated_connectors: vec![] }) };
        let ms = t.elapsed().as_millis();
        match r {
            Ok(o) => {
                let out_ref = o.value["output_ref"].as_str().unwrap_or("").to_string();
                let frame_hex = b.outputs.lock().unwrap().get(&out_ref).map(|v| hexs(v));
                results.push(json!({"id":s["id"],"capability_output":o.value,"output_frame_hex":frame_hex,"model_ran": *b.runs.lock().unwrap() > before,
                    "connector_evidence": o.connector_invocation_evidence.iter().map(|e| format!("{e:?}")).collect::<Vec<_>>(),"ms":ms}));
            }
            Err(e) => results.push(json!({"id":s["id"],"executor_error":format!("{e:?}"),"ms":ms})),
        }
    }
    println!("{}", serde_json::to_string_pretty(&json!({"host":"native: crates.io traverse-runtime 0.15.0 WasmExecutor::run_bytes_with_mediated_connectors (wasmtime) + exact_model::ExactModelHostConnector",
        "capability_wasm_sha256":cap_digest,"results":results})).unwrap());
}
