import type { FastifyPluginAsync } from "fastify";
import { getDeploymentEvents } from "./service";

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/events/:namespace/:app", {
    schema: {
      tags: ["Events"],
      summary: "Eventos do deployment",
      description: "Retorna eventos do Kubernetes relacionados ao deployment, replicasets e pods.",
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
          description: "Eventos do deployment",
          type: "object",
          properties: {
            namespace: { type: "string" },
            app: { type: "string" },
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  reason: { type: "string" },
                  message: { type: "string" },
                  count: { type: "number" },
                  firstTimestamp: { type: "string", nullable: true },
                  lastTimestamp: { type: "string", nullable: true },
                  source: { type: "string" },
                  involvedObject: {
                    type: "object",
                    properties: {
                      kind: { type: "string" },
                      name: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        403: { $ref: "HttpError#" },
      },
    },
  }, async (request: any) => {
    return getDeploymentEvents(request.params.namespace, request.params.app);
  });
};

export default eventsRoutes;
