import { describe, it, expect } from "vitest";
import { detectDocMime } from "./_core/fileType";

const pad = (head: number[], len = 16): Buffer => {
  const b = Buffer.alloc(len, 0);
  head.forEach((v, i) => (b[i] = v));
  return b;
};

describe("detectDocMime (magic bytes)", () => {
  it("reconhece PDF, PNG, JPEG e WEBP reais", () => {
    expect(detectDocMime(pad([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      "application/pdf"
    );
    expect(
      detectDocMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe("image/png");
    expect(detectDocMime(pad([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(
      detectDocMime(
        pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
      )
    ).toBe("image/webp");
  });

  it("REJEITA HTML/SVG/JS mesmo que o cliente jure ser imagem", () => {
    const html = Buffer.from("<!DOCTYPE html><script>alert(1)</script>");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectDocMime(html)).toBeNull();
    expect(detectDocMime(svg)).toBeNull();
  });

  it("REJEITA buffer curto/lixo (fail-closed)", () => {
    expect(detectDocMime(Buffer.alloc(4, 0))).toBeNull();
    expect(detectDocMime(pad([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("RIFF sem WEBP no offset 8 não passa (evita falso positivo)", () => {
    // RIFF de um WAV, por exemplo, não é imagem.
    expect(
      detectDocMime(
        pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
      )
    ).toBeNull();
  });
});
