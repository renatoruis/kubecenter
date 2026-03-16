import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { AppError } from "../../lib/k8s";
import { getResourceYaml } from "./service";

const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }
  return reply.status(500).send({ error: "UNEXPECTED_ERROR", message: "Unexpected error." });
};

const resourcesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/resources/:kind/:namespace/:name/yaml", {
    schema: {
      tags: ["Resources"],
      summary: "Obter YAML de um recurso Kubernetes",
      params: {
        type: "object",
        required: ["kind", "namespace", "name"],
        properties: {
          kind: {
            type: "string",
            description: "Tipo do recurso (deployment, service, ingress, configmap, secret, pod, replicaset)",
            example: "deployment",
          },
          namespace: { type: "string", description: "Namespace do recurso", example: "production" },
          name: { type: "string", description: "Nome do recurso", example: "payments-api" },
        },
      },
      response: {
        200: {
          description: "YAML do recurso",
          type: "object",
          properties: {
            yaml: { type: "string" },
          },
        },
        400: { $ref: "HttpError#" },
        403: { $ref: "HttpError#" },
        404: { $ref: "HttpError#" },
      },
    },
  }, async (request: any, reply) => {
    try {
      const { kind, namespace, name } = request.params;
      const yamlStr = await getResourceYaml(kind, namespace, name);
      return { yaml: yamlStr };
    } catch (error) {
      return sendError(reply, error);
    }
  });
};

export default resourcesRoutes;
