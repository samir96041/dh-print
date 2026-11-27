import assert from "node:assert/strict";
import { checkArtwork } from "./upload";
const b = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
assert.ok(checkArtwork("a.pdf", b("%PDF-1.7"), 100).ok);
assert.ok(checkArtwork("a.ai", b("%PDF-1.5"), 100).ok);
assert.ok(checkArtwork("a.svg", b('<svg xmlns="x"/>'), 100).ok);
assert.ok(checkArtwork("a.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 100).ok);
assert.ok(!checkArtwork("a.pdf", b("MZ\x90\x00"), 100).ok);        // renamed exe
assert.ok(!checkArtwork("a.exe", b("MZ"), 100).ok);                // bad ext
assert.ok(!checkArtwork("a.pdf", b("%PDF"), 20_000_000).ok);       // too big
console.log("upload ok");
