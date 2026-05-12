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
		if (!producer) {
			return null;
		}

		const stream = await producer.getStream();

		const tempFile = path.join(this.dir, randomUUID());

		return new Promise<string[] | null>((resolve, reject) => {
			const hashStream = createHash("sha1");

			const fileStream = createWriteStream(tempFile);

			stream.on("data", (chunk: Buffer) => {
				hashStream.update(chunk);
				fileStream.write(chunk);
			});

			stream.on("error", reject);
			fileStream.on("error", reject);

			stream.on("end", async () => {
				const hash = hashStream.digest("hex");

				this.cache
					.getOrFind<string>(
						hash,
						() =>
							new Promise((resolve, reject) => {
								const fpcalc = spawn("fpcalc", ["-json", tempFile]);

								fpcalc.on("error", reject);

								fpcalc.stderr.on("data", () => {});

								let output = "";
								fpcalc.stdout.on("data", (chunk: Buffer) => {
									output += chunk.toString();
								});

								fpcalc.addListener("close", (code) => {
									try {
										if (code !== 0 && code !== 3) {
											throw new Error(
												`fpcalc exited with non-zero code "${code}"`,
											);
										}

										const data: FpcalcOutput = JSON.parse(output);

										if (
											!("fingerprint" in data) ||
											typeof data.fingerprint != "string"
										) {
											throw new Error("Fingerprint missing from fpcalc output");
										}

										if (
											!("duration" in data) ||
											typeof data.duration != "number"
										) {
											throw new Error("Duration missing from fpcalc output");
										}
										if (!data.duration) {
											throw new Error("Duration from fpcalc is 0");
										}

										resolve(`${Math.round(data.duration)}:${data.fingerprint}`);
									} catch (e) {
										reject(e);
									}
								});
							}),
					)
					.then((fingerprint) => resolve([fingerprint]))
					.catch(reject);
			});
		}).finally(() => {
			rm(tempFile, {
				recursive: true,
			}).catch(console.error);
		});
	}
}
