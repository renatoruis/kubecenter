import type { FastifyPluginAsync } from "fastify";
import { getDeploymentLogs, getPodLogs, parseOptionalBoolean, parseOptionalNumber } from "./service";

const logsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/logs/:namespace/:app", {
    schema: {
      tags: ["Logs"],
      summary: "Logs do deployment completo",
      description: "Retorna logs de todos os pods e containers do deployment.",
      params: {
        type: "object",
        required: ["namespace", "app"],
        properties: {
          namespace: { type: "string", example: "production" },
          app: { type: "string", example: "payments-api" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          tailLines: { type: "number", example: 200 },
          sinceSeconds: { type: "number", example: 3600 },
          timestamps: { type: "boolean", example: false },
        },
      },
      response: {
        200: {
          description: "Logs agregados do deployment",
          type: "object",
          properties: {
            namespace: { type: "string" },
            app: { type: "string" },
            options: { type: "object" },
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pod: { type: "string" },
                  container: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any) => {
    return getDeploymentLogs(
      request.params.namespace,
      request.params.app,
      {
        tailLines: parseOptionalNumber(request.query.tailLines, "tailLines"),
        sinceSeconds: parseOptionalNumber(request.query.sinceSeconds, "sinceSeconds"),
        timestamps: parseOptionalBoolean(request.query.timestamps),
      },
    );
  });

  fastify.get("/logs/:namespace/:pod/:container", {
    schema: {
      tags: ["Logs"],
      summary: "Logs de um container",
      description:
        "Recupera logs de um container específico via API Kubernetes. Não possui cache.",
      params: {
        type: "object",
        required: ["namespace", "pod", "container"],
        properties: {
          namespace: { type: "string", description: "Namespace do pod", example: "production" },
          pod: { type: "string", description: "Nome do pod", example: "payments-api-abc123-xyz" },
          container: { type: "string", description: "Nome do container", example: "app" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          tailLines: {
            type: "number",
            description: "Número de linhas a retornar a partir do final",
            example: 200,
          },
          sinceSeconds: {
            type: "number",
            description: "Retornar logs dos últimos N segundos",
            example: 3600,
          },
          timestamps: {
            type: "boolean",
            description: "Incluir timestamps em cada linha",
            example: false,
          },
          follow: {
            type: "boolean",
            description: "Streaming contínuo de logs",
            example: false,
          },
        },
      },
      response: {
        200: {
          description: "Logs do container",
          type: "object",
          properties: {
            namespace: { type: "string" },
            pod: { type: "string" },
            container: { type: "string" },
            options: {
              type: "object",
              properties: {
                tailLines: { type: "number", nullable: true },
                sinceSeconds: { type: "number", nullable: true },
                timestamps: { type: "boolean" },
                follow: { type: "boolean" },
              },
            },
            content: { type: "string", description: "Conteúdo dos logs em texto" },
          },
        },
        403: { description: "Namespace não permitido", $ref: "HttpError#" },
        404: { description: "Pod ou container não encontrado", $ref: "HttpError#" },
        502: { description: "Erro ao ler logs do Kubernetes", $ref: "HttpError#" },
      },
    },
  }, async (request: any) => {
    return getPodLogs({
      namespace: request.params.namespace,
      pod: request.params.pod,
      container: request.params.container,
      tailLines: parseOptionalNumber(request.query.tailLines, "tailLines"),
      sinceSeconds: parseOptionalNumber(request.query.sinceSeconds, "sinceSeconds"),
      timestamps: parseOptionalBoolean(request.query.timestamps),
      follow: parseOptionalBoolean(request.query.follow),
    });
  });
};

export default logsRoutes;
