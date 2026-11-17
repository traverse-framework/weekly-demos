(module
  (memory (export "memory") 1)
  ;; model_execute(in, in_len, out, max_out) -> out_len
  ;; input frame: u32 LE "work units"; each unit = 1,000,000 LCG steps. Deterministic output.
  (func (export "model_execute") (param $in i32) (param $len i32) (param $out i32) (param $max i32) (result i32)
    (local $units i32) (local $u i32) (local $i i32) (local $x i32)
    (if (i32.lt_u (local.get $len) (i32.const 4)) (then (return (i32.const -2))))
    (if (i32.lt_u (local.get $max) (i32.const 8)) (then (return (i32.const -4))))
    (local.set $units (i32.load (local.get $in)))
    (local.set $x (i32.const 0x5EED))
    (block $done (loop $outer
      (br_if $done (i32.ge_u (local.get $u) (local.get $units)))
      (local.set $i (i32.const 0))
      (block $d2 (loop $inner
        (br_if $d2 (i32.ge_u (local.get $i) (i32.const 1000000)))
        (local.set $x (i32.add (i32.mul (local.get $x) (i32.const 1664525)) (i32.const 1013904223)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $inner)))
      (local.set $u (i32.add (local.get $u) (i32.const 1)))
      (br $outer)))
    (i32.store (local.get $out) (local.get $units))
    (i32.store (i32.add (local.get $out) (i32.const 4)) (local.get $x))
    (i32.const 8))
)
