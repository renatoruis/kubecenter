import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { isAppError } from "../lib/errors";

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply.status(error.status).send({
        error: error.code,
        message: error.message
      });
      return;
    }

    app.log.error(error);
    reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  });
};

export default fp(errorHandlerPlugin, {
  name: "error-handler"
});
