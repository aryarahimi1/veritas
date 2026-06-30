// Convert snarkjs verification_key.json + proof.json (BLS12-381) into the byte-encoded JSON args the
// soroban groth16_verifier expects (uncompressed G1=96B / G2=192B hex), via arkworks serialization.
//
//   encode <verification_key.json> <proof.json> <out_dir>
//   -> writes <out_dir>/vk.json and <out_dir>/proof.json (use with --vk-file-path / --proof-file-path)
//
// pub_signals are passed separately as plain u256 decimals (e.g. --pub_signals-file-path public.json).
use ark_bls12_381::{Fq, Fq2, G1Affine, G2Affine};
use ark_serialize::CanonicalSerialize;
use serde_json::Value;
use std::str::FromStr;

fn fq(v: &Value) -> Fq {
    Fq::from_str(v.as_str().expect("coord must be a decimal string")).unwrap()
}
fn g1(p: &Value) -> String {
    let a = G1Affine::new(fq(&p[0]), fq(&p[1]));
    let mut b = Vec::new();
    a.serialize_uncompressed(&mut b).unwrap();
    hex::encode(b) // 96 bytes
}
fn g2(p: &Value) -> String {
    // snarkjs G2 = [[x_c0, x_c1], [y_c0, y_c1], [..]]
    let x = Fq2::new(fq(&p[0][0]), fq(&p[0][1]));
    let y = Fq2::new(fq(&p[1][0]), fq(&p[1][1]));
    let a = G2Affine::new(x, y);
    let mut b = Vec::new();
    a.serialize_uncompressed(&mut b).unwrap();
    hex::encode(b) // 192 bytes
}
fn read(p: &str) -> Value {
    serde_json::from_reader(std::fs::File::open(p).expect("file")).expect("json")
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (vkey, proof, outdir) = (read(&args[1]), read(&args[2]), &args[3]);

    let ic: Vec<String> = vkey["IC"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| format!("\"{}\"", g1(p)))
        .collect();
    let vk = format!(
        "{{ \"alpha\": \"{}\", \"beta\": \"{}\", \"delta\": \"{}\", \"gamma\": \"{}\", \"ic\": [{}] }}",
        g1(&vkey["vk_alpha_1"]),
        g2(&vkey["vk_beta_2"]),
        g2(&vkey["vk_delta_2"]),
        g2(&vkey["vk_gamma_2"]),
        ic.join(", ")
    );
    let pf = format!(
        "{{ \"a\": \"{}\", \"b\": \"{}\", \"c\": \"{}\" }}",
        g1(&proof["pi_a"]),
        g2(&proof["pi_b"]),
        g1(&proof["pi_c"])
    );

    std::fs::create_dir_all(outdir).unwrap();
    std::fs::write(format!("{}/vk.json", outdir), vk).unwrap();
    std::fs::write(format!("{}/proof.json", outdir), pf).unwrap();
    println!("wrote {}/vk.json and {}/proof.json ({} IC points)", outdir, outdir, vkey["IC"].as_array().unwrap().len());
}
