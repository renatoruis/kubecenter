import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors";

interface AuthPluginOptions {
  apiToken?: string;
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  if (!options.apiToken) {
    return;
  }

  app.addHook("onRequest", async (request) => {
    const header = request.headers.authorization;
    const expectedHeader = `Bearer ${options.apiToken}`;

    if (header !== expectedHeader) {
      throw new AppError("UNAUTHORIZED", "Invalid or missing bearer token", 401);
    }
  });
};

export default fp(authPlugin, {
  name: "auth"
});
