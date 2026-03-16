import type { FastifyPluginAsync } from "fastify";
import { getMetricsByApp } from "./service";

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/metrics/:namespace/:app", {
    schema: {
      tags: ["Metrics"],
      summary: "Métricas de CPU e memória",
      description:
        "Coleta métricas de CPU e memória via `metrics.k8s.io`. Retorna totais por aplicação e breakdown por pod. Quando a API de métricas não estiver disponível, retorna `available: false` com aviso.",
      params: {
        type: "object",
        required: ["namespace", "app"],
        properties: {
          namespace: { type: "string", example: "production" },
          app: { type: "string", example: "payments-api" },
        },
      },
      response: {
        200: {
          description: "Métricas da aplicação",
          type: "object",
          properties: {
            namespace: { type: "string" },
            app: { type: "string" },
            available: { type: "boolean", description: "Indica se a API de métricas está acessível" },
            source: { type: "string", example: "metrics.k8s.io" },
            cpuUsage: { type: "string", example: "320m", description: "CPU total agregada em millicores" },
            memoryUsage: { type: "string", example: "540Mi", description: "Memória total agregada em MiB" },
            timestamp: { type: "string", format: "date-time" },
            totals: {
              type: "object",
              properties: {
                cpuNanoCores: { type: "number", example: 320000000 },
                memoryBytes: { type: "number", example: 566231040 },
                podCount: { type: "number", example: 3 },
              },
            },
            pods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pod: { type: "string", example: "payments-api-abc123" },
                  cpuNanoCores: { type: "number", example: 106666666 },
                  memoryBytes: { type: "number", example: 188743680 },
                },
              },
            },
            warnings: {
              type: "array",
              nullable: true,
              items: { type: "string" },
              example: ["metrics.k8s.io API is unavailable for this cluster/namespace"],
            },
          },
        },
        403: { description: "Namespace não permitido", $ref: "HttpError#" },
        502: { description: "Erro ao coletar métricas", $ref: "HttpError#" },
      },
    },
  }, async (request: any) => {
    return getMetricsByApp(request.params.namespace, request.params.app);
  });
};

export default metricsRoutes;
