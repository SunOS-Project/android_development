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

import {FunctionUtils, OnProgressUpdateType} from 'common/function_utils';
import {ParserError, ParserFactory} from 'parsers/parser_factory';
import {FrameMapper} from 'trace/frame_mapper';
import {Parser} from 'trace/parser';
import {TimestampType} from 'trace/timestamp';
import {Trace} from 'trace/trace';
import {Traces} from 'trace/traces';
import {LoadedTraceFile, TraceFile} from 'trace/trace_file';
import {TraceType} from 'trace/trace_type';

class TracePipeline {
  private parserFactory = new ParserFactory();
  private parsers: Array<Parser<object>> = [];
  private traces?: Traces;
  private commonTimestampType?: TimestampType;

  async loadTraceFiles(
    traceFiles: TraceFile[],
    onLoadProgressUpdate: OnProgressUpdateType = FunctionUtils.DO_NOTHING
  ): Promise<ParserError[]> {
    const [parsers, parserErrors] = await this.parserFactory.createParsers(
      traceFiles,
      onLoadProgressUpdate
    );
    this.parsers = parsers;
    return parserErrors;
  }

  removeTraceFile(type: TraceType) {
    this.parsers = this.parsers.filter((parser) => parser.getTraceType() !== type);
  }

  getLoadedTraceFiles(): LoadedTraceFile[] {
    return this.parsers.map(
      (parser: Parser<object>) => new LoadedTraceFile(parser.getTraceFile(), parser.getTraceType())
    );
  }

  buildTraces() {
    const commonTimestampType = this.getCommonTimestampType();

    this.traces = new Traces();
    this.parsers.forEach((parser) => {
      const trace = new Trace(
        parser.getTraceType(),
        parser.getTraceFile(),
        undefined,
        parser,
        commonTimestampType,
        {start: 0, end: parser.getLengthEntries()}
      );
      this.traces?.setTrace(parser.getTraceType(), trace);
    });
    new FrameMapper(this.traces).computeMapping();
  }

  getTraces(): Traces {
    this.checkTracesWereBuilt();
    return this.traces!;
  }

  getScreenRecordingVideo(): undefined | Blob {
    const screenRecording = this.getTraces().getTrace(TraceType.SCREEN_RECORDING);
    if (!screenRecording || screenRecording.lengthEntries === 0) {
      return undefined;
    }
    return screenRecording.getEntry(0).getValue().videoData;
  }

  clear() {
    this.parserFactory = new ParserFactory();
    this.parsers = [];
    this.traces = undefined;
    this.commonTimestampType = undefined;
  }

  private getCommonTimestampType(): TimestampType {
    if (this.commonTimestampType !== undefined) {
      return this.commonTimestampType;
    }

    const priorityOrder = [TimestampType.REAL, TimestampType.ELAPSED];
    for (const type of priorityOrder) {
      if (this.parsers.every((it) => it.getTimestamps(type) !== undefined)) {
        this.commonTimestampType = type;
        return this.commonTimestampType;
      }
    }

    throw Error('Failed to find common timestamp type across all traces');
  }

  private checkTracesWereBuilt() {
    if (!this.traces) {
      throw new Error(
        `Can't access traces before building them. Did you forget to call '${this.buildTraces.name}'?`
      );
    }
  }
}

export {TracePipeline};
