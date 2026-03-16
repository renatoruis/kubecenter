import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { getApplicationNetwork } from "./service";


const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const networkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/network/:namespace/:app", {
    schema: {
      tags: ["Network"],
      summary: "Services e Ingress de uma aplicação",
      description:
        "Retorna os Services vinculados ao Deployment e os Ingresses que apontam para esses Services, incluindo hosts e portas.",
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
          description: "Topologia de rede da aplicação",
          type: "object",
          properties: {
            app: { type: "string" },
            namespace: { type: "string" },
            selector: { type: "object", additionalProperties: { type: "string" } },
            services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", nullable: true },
                  type: { type: "string", nullable: true, example: "ClusterIP" },
                  clusterIP: { type: "string", nullable: true, example: "10.96.45.12" },
                  selector: { type: "object", additionalProperties: { type: "string" } },
                  ports: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", nullable: true },
                        port: { type: "number", example: 80 },
                        targetPort: { type: ["string", "number"], example: 8080 },
                        protocol: { type: "string", example: "TCP" },
                      },
                    },
                  },
                },
              },
            },
            ingress: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", nullable: true },
                  className: { type: "string", nullable: true, example: "nginx" },
                  hosts: { type: "array", items: { type: "string" }, example: ["payments.example.com"] },
                },
              },
            },
          },
        },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      return await getApplicationNetwork(request.params.namespace, request.params.app);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default networkRoutes;
