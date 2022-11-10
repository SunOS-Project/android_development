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
import {ArrayUtils} from "common/utils/array_utils";
import {Timestamp, TimestampType} from "common/trace/timestamp";
import {TraceType} from "common/trace/trace_type";
import {Parser} from "parsers/parser";
import {ParserError, ParserFactory} from "parsers/parser_factory";
import { setTraces } from "trace_collection/set_traces";
import { Viewer } from "viewers/viewer";
import { ViewerFactory } from "viewers/viewer_factory";
import { LoadedTrace } from "app/loaded_trace";
import { FileUtils } from "common/utils/file_utils";
import { TRACE_INFO } from "app/trace_info";

class TraceCoordinator {
  private parsers: Parser[];
  private viewers: Viewer[];

  constructor() {
    this.parsers = [];
    this.viewers = [];
  }

  public async addTraces(traces: File[]) {
    traces = this.parsers.map(parser => parser.getTrace()).concat(traces);
    let parserErrors: ParserError[];
    [this.parsers, parserErrors] = await new ParserFactory().createParsers(traces);
    return parserErrors;
  }

  public removeTrace(type: TraceType) {
    this.parsers = this.parsers.filter(parser => parser.getTraceType() !== type);
  }

  public createViewers() {
    const activeTraceTypes = this.parsers.map(parser => parser.getTraceType());
    console.log("active trace types: ", activeTraceTypes);

    this.viewers = new ViewerFactory().createViewers(new Set<TraceType>(activeTraceTypes));
    console.log("created viewers: ", this.viewers);
  }

  public getLoadedTraces(): LoadedTrace[] {
    return this.parsers.map((parser: Parser) => {
      const name = (<File>parser.getTrace()).name;
      const type = parser.getTraceType();
      return {name: name, type: type};
    });
  }

  public getParsers(): Parser[] {
    return this.parsers;
  }

  public getViewers(): Viewer[] {
    return this.viewers;
  }

  public findParser(traceType: TraceType): Parser | null {
    const parser = this.parsers.find(parser => parser.getTraceType() === traceType);
    return parser ?? null;
  }

  public getTimestamps(): Timestamp[] {
    for (const type of [TimestampType.REAL, TimestampType.ELAPSED]) {
      const mergedTimestamps: Timestamp[] = [];

      let isTypeProvidedByAllParsers = true;

      for(const timestamps of this.parsers.map(parser => parser.getTimestamps(type))) {
        if (timestamps === undefined) {
          isTypeProvidedByAllParsers = false;
          break;
        }
        mergedTimestamps.push(...timestamps!);
      }

      if (isTypeProvidedByAllParsers) {
        const uniqueTimestamps = [... new Set<Timestamp>(mergedTimestamps)];
        uniqueTimestamps.sort();
        return uniqueTimestamps;
      }
    }

    throw new Error("Failed to create aggregated timestamps (any type)");
  }

  public notifyCurrentTimestamp(timestamp: Timestamp|undefined) {
    if (!timestamp) {
      return;
    }

    const traceEntries: Map<TraceType, any> = new Map<TraceType, any>();

    this.parsers.forEach(parser => {
      const targetTimestamp = timestamp;
      const entry = parser.getTraceEntry(targetTimestamp);
      let prevEntry = null;

      const parserTimestamps = parser.getTimestamps(timestamp.getType());
      if (parserTimestamps === undefined) {
        throw new Error(`Unexpected timestamp type ${timestamp.getType()}.`
          + ` Not supported by parser for trace type: ${parser.getTraceType()}`);
      }

      const index = ArrayUtils.binarySearchLowerOrEqual(parserTimestamps, targetTimestamp);
      if (index !== undefined && index > 0) {
        prevEntry = parser.getTraceEntry(parserTimestamps[index-1]);
      }

      if (entry !== undefined) {
        traceEntries.set(parser.getTraceType(), [entry, prevEntry]);
      }
    });

    this.viewers.forEach(viewer => {
      viewer.notifyCurrentTraceEntries(traceEntries);
    });
  }

  public clearData() {
    this.parsers = [];
    this.viewers = [];
    setTraces.dataReady = false;
  }

  public async getUnzippedFiles(files: File[]): Promise<File[]> {
    const unzippedFiles: File[] = [];
    for (let i=0; i<files.length; i++) {
      if (FileUtils.isZipFile(files[i])) {
        const unzippedFile = await FileUtils.unzipFile(files[i]);
        unzippedFiles.push(...unzippedFile);
      } else {
        unzippedFiles.push(files[i]);
      }
    }
    return unzippedFiles;
  }

  public async getTraceForDownload(parser: Parser): Promise<File | null> {
    const trace = parser.getTrace();
    if (trace) {
      const traceType = TRACE_INFO[parser.getTraceType()].name;
      const name = traceType + "/" + FileUtils.removeDirFromFileName(trace.name);
      const blob = await trace.arrayBuffer();
      return new File([blob], name);
    }
    return null;
  }

  public async getAllTracesForDownload(): Promise<File[]> {
    const traces: File[] = [];
    for (let i=0; i < this.parsers.length; i++) {
      const trace = await this.getTraceForDownload(this.parsers[i]);
      if (trace) {
        traces.push(trace);
      }
    }
    return traces;
  }
}

export { TraceCoordinator };
