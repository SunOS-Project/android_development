/*
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Timestamp, TimestampType} from "common/trace/timestamp";
import {TraceType} from "common/trace/trace_type";
import {Parser} from "./parser";
import {UnitTestUtils} from "test/unit/utils";

describe("ParserInputMethodlClients", () => {
  describe("trace with elapsed + real timestamp", () => {
    let parser: Parser;

    beforeAll(async () => {
      parser = await UnitTestUtils.getParser("traces/elapsed_and_real_timestamp/InputMethodClients.pb");
    });

    it("has expected trace type", () => {
      expect(parser.getTraceType()).toEqual(TraceType.INPUT_METHOD_CLIENTS);
    });

    it("provides elapsed timestamps", () => {
      expect(parser.getTimestamps(TimestampType.ELAPSED)!.length)
        .toEqual(13);

      const expected = [
        new Timestamp(TimestampType.ELAPSED, 15613638434n),
        new Timestamp(TimestampType.ELAPSED, 15647516364n),
        new Timestamp(TimestampType.ELAPSED, 15677650967n),
      ];
      expect(parser.getTimestamps(TimestampType.ELAPSED)!.slice(0, 3))
        .toEqual(expected);
    });

    it("provides real timestamps", () => {
      const expected = [
        new Timestamp(TimestampType.REAL, 1659107090215405395n),
        new Timestamp(TimestampType.REAL, 1659107090249283325n),
        new Timestamp(TimestampType.REAL, 1659107090279417928n),
      ];
      expect(parser.getTimestamps(TimestampType.REAL)!.slice(0, 3))
        .toEqual(expected);
    });

    it("retrieves trace entry from elapsed timestamp", () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 15647516364n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.elapsedRealtimeNanos))
        .toEqual(15647516364n);
    });

    it("retrieves trace entry from real timestamp", () => {
      const timestamp = new Timestamp(TimestampType.REAL, 1659107090249283325n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.elapsedRealtimeNanos))
        .toEqual(15647516364n);
    });
  });

  describe("trace with elapsed (only) timestamp", () => {
    let parser: Parser;

    beforeAll(async () => {
      parser = await UnitTestUtils.getParser("traces/elapsed_timestamp/InputMethodClients.pb");
    });

    it("has expected trace type", () => {
      expect(parser.getTraceType()).toEqual(TraceType.INPUT_METHOD_CLIENTS);
    });

    it("provides elapsed timestamps", () => {
      expect(parser.getTimestamps(TimestampType.ELAPSED)![0])
        .toEqual(new Timestamp(TimestampType.ELAPSED, 1149083651642n));
    });

    it("doesn't provide real timestamps", () => {
      expect(parser.getTimestamps(TimestampType.ELAPSED)![0])
        .toEqual(new Timestamp(TimestampType.ELAPSED, 1149083651642n));
    });
  });
});
