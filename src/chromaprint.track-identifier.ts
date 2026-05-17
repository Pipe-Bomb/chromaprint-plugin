import { createHash, randomUUID } from "node:crypto";
import {
	PluginApiContext,
	TrackIdentifier,
	TrackIdentifierTarget,
	TrackInformationHelper,
} from "@sdk";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { PersistentCache } from "./persistent-cache.js";
import { rm } from "node:fs/promises";
import { once } from "node:stream";

interface FpcalcOutput {
	duration: number;
	fingerprint: string;
}

export class ChromaprintTrackIdentifier implements TrackIdentifier {
	public readonly id = "chromaprint";
	public readonly target: TrackIdentifierTarget = "track";

	private readonly cache: PersistentCache;
	private readonly tempDirCallbacks = new Set<() => void>();
	private dir!: string;

	constructor(
		private readonly api: PluginApiContext,
		dbFile: string,
	) {
		this.cache = new PersistentCache(dbFile);

		api.requestTempDirectory().then((dir) => {
			this.dir = dir;
			for (const callback of this.tempDirCallbacks) {
				callback();
			}
		});
	}

	getDependencies() {
		return [];
	}
	getSoftDependencies() {
		return [];
	}

	async identify(helper: TrackInformationHelper): Promise<string[] | null> {
		if (!this.dir) {
			await new Promise<void>((r) => this.tempDirCallbacks.add(r));
		}

		const producer = await helper.getAudioProducer("stream");
		if (!producer) return null;

		const stream = await producer.getStream();

		const tempFile = path.join(this.dir, randomUUID());

		const hash = createHash("sha1");
		const fileStream = createWriteStream(tempFile);

		try {
			stream.on("data", (chunk) => hash.update(chunk));

			await once(stream.pipe(fileStream), "finish");

			const digest = hash.digest("hex");

			const fingerprint = await this.cache.getOrFind<string>(
				digest,
				() =>
					new Promise((resolve, reject) => {
						const fpcalc = spawn("fpcalc", ["-json", tempFile]);

						let output = "";

						fpcalc.stdout.on("data", (c) => (output += c.toString()));
						fpcalc.stderr.resume();

						fpcalc.on("error", reject);

						fpcalc.on("close", (code) => {
							try {
								if (code !== 0 && code !== 3) {
									throw new Error(`fpcalc failed: ${code}`);
								}

								const data = JSON.parse(output);

								resolve(`${Math.round(data.duration)}:${data.fingerprint}`);
							} catch (e) {
								reject(e);
							}
						});
					}),
			);

			return [fingerprint];
		} finally {
			rm(tempFile).catch(console.error);
		}
	}
}
