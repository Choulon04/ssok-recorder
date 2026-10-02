// whisper.cpp writes each token's raw bytes into its JSON output. Tokens for Korean, Japanese,
// Chinese and emoji regularly end in the middle of a multi-byte UTF-8 character, so reading the
// file as UTF-8 turns those fragments into U+FFFD and the characters are lost for good.
// We read the file as latin1 (one char per byte), then re-join fragments across tokens.

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null;
}

/** True when the string holds only byte values, i.e. it came straight from a latin1 read. */
function isByteString(value: string) {
	for (let index = 0; index < value.length; index += 1) {
		if (value.charCodeAt(index) > 0xff) return false;
	}
	return true;
}

function utf8SequenceLength(leadByte: number) {
	if (leadByte < 0x80) return 1;
	if (leadByte >= 0xf0) return 4;
	if (leadByte >= 0xe0) return 3;
	if (leadByte >= 0xc0) return 2;
	return 0; // continuation byte
}

/** Length of the longest prefix that does not end inside an unfinished UTF-8 sequence. */
export function completeUtf8PrefixLength(bytes: Uint8Array) {
	const lookback = Math.max(0, bytes.length - 4);
	for (let index = bytes.length - 1; index >= lookback; index -= 1) {
		const sequenceLength = utf8SequenceLength(bytes[index]);
		if (sequenceLength === 0) continue;
		return index + sequenceLength <= bytes.length ? bytes.length : index;
	}
	return bytes.length;
}

function decodeByteString(value: string) {
	return isByteString(value) ? Buffer.from(value, "latin1").toString("utf8") : value;
}

function repairTokens(tokens: unknown[]) {
	let carry = Buffer.alloc(0);
	for (const token of tokens) {
		if (!isRecord(token) || typeof token.text !== "string") continue;
		if (!isByteString(token.text)) {
			carry = Buffer.alloc(0);
			continue;
		}
		const bytes = Buffer.concat([carry, Buffer.from(token.text, "latin1")]);
		const completeLength = completeUtf8PrefixLength(bytes);
		token.text = bytes.subarray(0, completeLength).toString("utf8");
		carry = Buffer.from(bytes.subarray(completeLength));
	}
}

/** Returns whisper's JSON output as a properly decoded JSON string. */
export function decodeWhisperJsonOutput(buffer: Buffer): string {
	let parsed: unknown;
	try {
		parsed = JSON.parse(buffer.toString("latin1"));
	} catch {
		return buffer.toString("utf8");
	}
	if (!isRecord(parsed) || !Array.isArray(parsed.transcription)) {
		return buffer.toString("utf8");
	}
	for (const segment of parsed.transcription) {
		if (!isRecord(segment)) continue;
		if (typeof segment.text === "string") segment.text = decodeByteString(segment.text);
		if (Array.isArray(segment.tokens)) repairTokens(segment.tokens);
	}
	return JSON.stringify(parsed);
}
