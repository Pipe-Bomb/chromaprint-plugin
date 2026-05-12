import type PipeBomb from "@sdk";
import { ChromaprintTrackIdentifier } from "./chromaprint.track-identifier.js";
import path from "path";

export default class Plugin implements PipeBomb.Plugin {
	private api!: PipeBomb.PluginApiContext;
	private logger!: PipeBomb.Logger;

	enable(apiContext: PipeBomb.PluginApiContext) {
		this.api = apiContext;
		this.logger = apiContext.getLogger();

		this.logger.log("Chromaprint Identifier is ready!");

		this.api.registerLanguageDirectory("language");

		this.api.requestCacheDirectory().then((cacheDir) => {
			this.api.registerTrackIdentifier(
				new ChromaprintTrackIdentifier(
					this.api,
					path.join(cacheDir, "cache.db"),
				),
			);
		});
	}

	disable() {}

	public getLogger() {
		return this.logger;
	}

	public getApi() {
		return this.api;
	}
}
