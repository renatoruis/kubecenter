import type { FastifyPluginAsync } from "fastify";
import { getClusterOverview } from "./service";

const clusterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", {
    schema: {
      tags: ["Cluster"],
      summary: "Visão geral do cluster",
      description:
        "Retorna informações gerais do cluster: nós, namespaces monitorados, totais de pods, deployments e services.",
      response: {
        200: {
          description: "Sucesso",
          type: "object",
          properties: {
            watchedNamespaces: { type: "array", items: { type: "string" }, example: ["default", "production"] },
            nodes: {
              type: "object",
              properties: {
                total: { type: "number", example: 2 },
                ready: { type: "number", example: 2 },
                notReady: { type: "number", example: 0 },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", example: "hz-dev-server-1" },
                      status: { type: "string", enum: ["Ready", "NotReady", "Unknown"] },
                      roles: { type: "array", items: { type: "string" }, example: ["control-plane"] },
                      kubeletVersion: { type: "string", example: "v1.32.3+k3s1" },
                      os: { type: "string", example: "Ubuntu 24.04.1 LTS" },
                      arch: { type: "string", example: "amd64" },
                      cpu: { type: "string", example: "12" },
                      memory: { type: "string", example: "131813272Ki" },
                    },
                  },
                },
              },
            },
            namespaces: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: { type: "string", example: "Active" },
                  deployments: { type: "number" },
                  pods: { type: "number" },
                  runningPods: { type: "number" },
                },
              },
            },
            totals: {
              type: "object",
              properties: {
                deployments: { type: "number" },
                pods: { type: "number" },
                runningPods: { type: "number" },
                services: { type: "number" },
              },
            },
            collectedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  }, async () => {
    return getClusterOverview();
  });
};

export default clusterRoutes;
