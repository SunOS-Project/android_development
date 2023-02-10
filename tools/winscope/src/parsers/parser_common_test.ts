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
import {CommonTestUtils} from 'test/common/utils';
import {UnitTestUtils} from 'test/unit/utils';
import {Timestamp, TimestampType} from 'trace/timestamp';
import {TraceFile} from 'trace/trace';
import {TraceType} from 'trace/trace_type';
import {Parser} from './parser';
import {ParserFactory} from './parser_factory';

describe('Parser', () => {
  it('is robust to empty trace file', async () => {
    const trace = new TraceFile(await CommonTestUtils.getFixtureFile('traces/empty.pb'), undefined);
    const [parsers, errors] = await new ParserFactory().createParsers([trace]);
    expect(parsers.length).toEqual(0);
  });

  it('is robust to trace with no entries', async () => {
    const parser = await UnitTestUtils.getParser('traces/no_entries_InputMethodClients.pb');

    expect(parser.getTraceType()).toEqual(TraceType.INPUT_METHOD_CLIENTS);
    expect(parser.getTimestamps(TimestampType.ELAPSED)).toEqual([]);
    expect(parser.getTimestamps(TimestampType.REAL)).toEqual([]);

    const timestampElapsed = new Timestamp(TimestampType.ELAPSED, 0n);
    expect(parser.getTraceEntry(timestampElapsed)).toBeUndefined();

    const timestampReal = new Timestamp(TimestampType.REAL, 0n);
    expect(parser.getTraceEntry(timestampReal)).toBeUndefined();
  });

  describe('real timestamp', () => {
    let parser: Parser;

    beforeAll(async () => {
      parser = await UnitTestUtils.getParser('traces/elapsed_and_real_timestamp/WindowManager.pb');
    });

    it('provides timestamps', () => {
      const expected = [
        new Timestamp(TimestampType.REAL, 1659107089075566202n),
        new Timestamp(TimestampType.REAL, 1659107089999048990n),
        new Timestamp(TimestampType.REAL, 1659107090010194213n),
      ];
      expect(parser.getTimestamps(TimestampType.REAL)!.slice(0, 3)).toEqual(expected);
    });

    it('retrieves trace entry (no timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.REAL, 1659107089075566201n);
      expect(parser.getTraceEntry(timestamp)).toEqual(undefined);
    });

    it('retrieves trace entry (equal timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.REAL, 1659107089075566202n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.unixNanos.toString())).toEqual(
        1659107089075566202n
      );
    });

    it('retrieves trace entry (equal timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.REAL, 1659107089999048990n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.unixNanos.toString())).toEqual(
        1659107089999048990n
      );
    });

    it('retrieves trace entry (lower timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.REAL, 1659107089999048991n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.unixNanos.toString())).toEqual(
        1659107089999048990n
      );
    });
  });

  describe('elapsed timestamp', () => {
    let parser: Parser;

    beforeAll(async () => {
      parser = await UnitTestUtils.getParser('traces/elapsed_timestamp/WindowManager.pb');
    });

    it('provides timestamps', () => {
      const expected = [
        new Timestamp(TimestampType.ELAPSED, 850254319343n),
        new Timestamp(TimestampType.ELAPSED, 850763506110n),
        new Timestamp(TimestampType.ELAPSED, 850782750048n),
      ];
      expect(parser.getTimestamps(TimestampType.ELAPSED)).toEqual(expected);
    });

    it('retrieves trace entry (no timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 850254319342n);
      expect(parser.getTraceEntry(timestamp)).toEqual(undefined);
    });

    it('retrieves trace entry (equal timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 850254319343n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.elapsedNanos.toString())).toEqual(
        850254319343n
      );
    });

    it('retrieves trace entry (equal timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 850763506110n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.elapsedNanos.toString())).toEqual(
        850763506110n
      );
    });

    it('retrieves trace entry (lower timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 850254319344n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.elapsedNanos.toString())).toEqual(
        850254319343n
      );
    });

    it('retrieves trace entry (equal timestamp matches)', () => {
      const timestamp = new Timestamp(TimestampType.ELAPSED, 850763506111n);
      expect(BigInt(parser.getTraceEntry(timestamp)!.timestamp.elapsedNanos.toString())).toEqual(
        850763506110n
      );
    });
  });
});
