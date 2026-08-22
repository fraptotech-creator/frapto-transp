import { describe, it, expect } from "vitest";
import {
  buildAlerts,
  DEFAULT_NOTIFICATION_SETTINGS as DEF,
  type NotificationSettings,
  type AlertData,
} from "./_core/notifications";

const AGORA = new Date("2026-06-01T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const emDias = (n: number) => new Date(AGORA.getTime() + n * DIA);

function dados(p: Partial<AlertData>): AlertData {
  return { vehicles: [], drivers: [], maintenances: [], documents: [], ...p };
}
function settings(p: Partial<NotificationSettings> = {}): NotificationSettings {
  return { ...DEF, ...p };
}

describe("buildAlerts — janelas de dias (default 30/30/7)", () => {
  it("CNH: alerta dentro da janela, silêncio fora", () => {
    const drivers = [
      { id: 1, nome: "Ana", cnhVencimento: emDias(20) },
      { id: 2, nome: "Bia", cnhVencimento: emDias(40) },
    ];
    const a = buildAlerts(dados({ drivers }), settings(), AGORA);
    const cnh = a.filter(x => x.type === "cnh");
    expect(cnh).toHaveLength(1);
    expect(cnh[0].message).toContain("Ana");
  });

  it("janela é configurável: cnhDiasAntes=60 pega o de 40 dias", () => {
    const drivers = [{ id: 2, nome: "Bia", cnhVencimento: emDias(40) }];
    expect(
      buildAlerts(dados({ drivers }), settings({ cnhDiasAntes: 60 }), AGORA)
    ).toHaveLength(1);
    expect(
      buildAlerts(dados({ drivers }), settings({ cnhDiasAntes: 30 }), AGORA)
    ).toHaveLength(0);
  });

  it("CRLV do veículo respeita crlvDiasAntes", () => {
    const vehicles = [{ id: 1, placa: "ABC1D23", crlvVencimento: emDias(10) }];
    expect(
      buildAlerts(dados({ vehicles }), settings(), AGORA).filter(
        x => x.title === "CRLV Vencendo"
      )
    ).toHaveLength(1);
  });

  it("manutenção pendente dentro de manutencaoDiasAntes", () => {
    const maintenances = [
      { veiculoId: 1, status: "pendente", dataPrevista: emDias(3) },
      { veiculoId: 1, status: "concluida", dataPrevista: emDias(1) },
      { veiculoId: 1, status: "pendente", dataPrevista: emDias(20) },
    ];
    const vehicles = [{ id: 1, placa: "ABC1D23", crlvVencimento: null }];
    const a = buildAlerts(dados({ maintenances, vehicles }), settings(), AGORA);
    expect(a.filter(x => x.type === "manutencao")).toHaveLength(1);
  });
});

describe("buildAlerts — liga/desliga por tipo", () => {
  it("cnhEnabled=false silencia CNH mesmo vencendo", () => {
    const drivers = [{ id: 1, nome: "Ana", cnhVencimento: emDias(5) }];
    expect(
      buildAlerts(dados({ drivers }), settings({ cnhEnabled: false }), AGORA)
    ).toHaveLength(0);
  });

  it("documentosEnabled=false silencia a tabela documents", () => {
    const documents = [
      {
        tipo: "seguro",
        descricao: "Apólice",
        veiculoId: null,
        motoristId: null,
        dataVencimento: emDias(5),
      },
    ];
    expect(
      buildAlerts(
        dados({ documents }),
        settings({ documentosEnabled: false }),
        AGORA
      )
    ).toHaveLength(0);
    expect(
      buildAlerts(dados({ documents }), settings(), AGORA).filter(
        x => x.title === "Documento Vencendo"
      )
    ).toHaveLength(1);
  });
});

describe("buildAlerts — escalonamento de urgência", () => {
  it("data-based vira 'alta' em ≤ urgenciaAltaDiasAntes, senão 'media'", () => {
    const drivers = [
      { id: 1, nome: "Ana", cnhVencimento: emDias(3) }, // ≤7 → alta
      { id: 2, nome: "Bia", cnhVencimento: emDias(20) }, // >7 → media
    ];
    const a = buildAlerts(dados({ drivers }), settings(), AGORA);
    const ana = a.find(x => x.message.includes("Ana"));
    const bia = a.find(x => x.message.includes("Bia"));
    expect(ana?.urgency).toBe("alta");
    expect(bia?.urgency).toBe("media");
  });

  it("CNH já vencida (data no passado) → alta", () => {
    const drivers = [{ id: 1, nome: "Ana", cnhVencimento: emDias(-3) }];
    expect(buildAlerts(dados({ drivers }), settings(), AGORA)[0].urgency).toBe(
      "alta"
    );
  });
});

describe("buildAlerts — óleo (% configurável)", () => {
  const vehicles = [
    {
      id: 1,
      placa: "ABC1D23",
      crlvVencimento: null,
      quilometragem: 9500,
      kmUltimaTrocaOleo: 0,
      intervaloTrocaOleoKm: 10000, // faltam 500 km
    },
  ];
  it("10%: faltando 500/10000 (≤1000) → alerta 'próxima' (media)", () => {
    const a = buildAlerts(dados({ vehicles }), settings(), AGORA).filter(
      x => x.type === "oleo"
    );
    expect(a).toHaveLength(1);
    expect(a[0].urgency).toBe("media");
  });
  it("3%: limite 300 < 500 restantes → sem alerta", () => {
    expect(
      buildAlerts(
        dados({ vehicles }),
        settings({ oleoPercentAntes: 3 }),
        AGORA
      ).filter(x => x.type === "oleo")
    ).toHaveLength(0);
  });
  it("oleoEnabled=false → sem alerta de óleo", () => {
    expect(
      buildAlerts(
        dados({ vehicles }),
        settings({ oleoEnabled: false }),
        AGORA
      ).filter(x => x.type === "oleo")
    ).toHaveLength(0);
  });
});

describe("buildAlerts — teto de 10 e ordem", () => {
  it("no máximo 10 alertas", () => {
    const drivers = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      nome: `M${i}`,
      cnhVencimento: emDias(1),
    }));
    expect(buildAlerts(dados({ drivers }), settings(), AGORA)).toHaveLength(10);
  });

  it("ordem estável: manutenção antes de CNH", () => {
    const vehicles = [{ id: 1, placa: "ABC1D23", crlvVencimento: null }];
    const maintenances = [
      { veiculoId: 1, status: "pendente", dataPrevista: emDias(1) },
    ];
    const drivers = [{ id: 1, nome: "Ana", cnhVencimento: emDias(1) }];
    const a = buildAlerts(
      dados({ vehicles, maintenances, drivers }),
      settings(),
      AGORA
    );
    expect(a[0].type).toBe("manutencao");
    expect(a.some(x => x.type === "cnh")).toBe(true);
  });
});
