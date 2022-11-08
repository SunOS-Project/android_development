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
import {TransactionsTraceEntry} from "../common/trace/transactions";

describe("ParserTransactions", () => {
  describe("trace with elapsed + real timestamp", () => {
    let parser: Parser;

    beforeAll(async () => {
      parser = await UnitTestUtils.getParser("traces/elapsed_and_real_timestamp/Transactions.pb");
    });

    it("has expected trace type", () => {
      expect(parser.getTraceType()).toEqual(TraceType.TRANSACTIONS);
    });

    it("provides elapsed timestamps", () => {
      const timestamps = parser.getTimestamps(TimestampType.ELAPSED)!;

      expect(timestamps.length)
        .toEqual(712);

      const expected = [
        new Timestamp(TimestampType.ELAPSED, 2450981445n),
        new Timestamp(TimestampType.ELAPSED, 2517952515n),
        new Timestamp(TimestampType.ELAPSED, 4021151449n),
      ];
      expect(timestamps.slice(0, 3))
        .toEqual(expected);
    });

    it("provides real timestamps", () => {
      const timestamps = parser.getTimestamps(TimestampType.REAL)!;

      expect(timestamps.length)
        .toEqual(712);

      const expected = [
        new Timestamp(TimestampType.REAL, 1659507541051480997n),
        new Timestamp(TimestampType.REAL, 1659507541118452067n),
        new Timestamp(TimestampType.REAL, 1659507542621651001n),
      ];
      expect(timestamps.slice(0, 3))
        .toEqual(expected);
    });

    it("retrieves trace entry from elapsed timestamp", () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 2517952515n);
      const entry: TransactionsTraceEntry = parser.getTraceEntry(timestamp)!;
      expect(entry.currentEntryIndex).toEqual(1);
      expect(BigInt(entry.entriesProto[entry.currentEntryIndex].elapsedRealtimeNanos))
        .toEqual(2517952515n);
    });

    it("retrieves trace entry from real timestamp", () => {
      const timestamp = new Timestamp(TimestampType.REAL, 1659507541118452067n);
      const entry: TransactionsTraceEntry = parser.getTraceEntry(timestamp)!;
      expect(entry.currentEntryIndex).toEqual(1);
      expect(BigInt(entry.entriesProto[entry.currentEntryIndex].elapsedRealtimeNanos))
        .toEqual(2517952515n);
    });

    it("decodes 'what' field in proto", () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 2517952515n);
      const entry: TransactionsTraceEntry = parser.getTraceEntry(timestamp)!;

      expect(entry.entriesProto[0].transactions[0].layerChanges[0].what)
        .toEqual("eLayerChanged");
      expect(entry.entriesProto[0].transactions[1].layerChanges[0].what)
        .toEqual("eFlagsChanged | eDestinationFrameChanged");
      expect(entry.entriesProto[222].transactions[1].displayChanges[0].what)
        .toEqual("eLayerStackChanged | eDisplayProjectionChanged | eFlagsChanged");
    });
  });

  describe("trace with elapsed (only) timestamp", () => {
    let parser: Parser;

    beforeAll(async () => {
      parser = await UnitTestUtils.getParser("traces/elapsed_timestamp/Transactions.pb");
    });

    it("has expected trace type", () => {
      expect(parser.getTraceType()).toEqual(TraceType.TRANSACTIONS);
    });

    it("provides elapsed timestamps", () => {
      const timestamps = parser.getTimestamps(TimestampType.ELAPSED)!;

      expect(timestamps.length)
        .toEqual(4997);

      const expected = [
        new Timestamp(TimestampType.ELAPSED, 14862317023n),
        new Timestamp(TimestampType.ELAPSED, 14873423549n),
        new Timestamp(TimestampType.ELAPSED, 14884850511n),
      ];
      expect(timestamps.slice(0, 3))
        .toEqual(expected);
    });

    it("doesn't provide real timestamps", () => {
      expect(parser.getTimestamps(TimestampType.REAL))
        .toEqual(undefined);
    });
  });
});
