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
import {WindowManagerServiceDumpProto} from "./proto_types";
import {WindowManagerState} from "common/trace/flickerlib/windows/WindowManagerState";

class ParserWindowManagerDump extends Parser {
  constructor(trace: File) {
    super(trace);
  }

  override getTraceType(): TraceType {
    return TraceType.WINDOW_MANAGER;
  }

  override getMagicNumber(): undefined {
    return undefined;
  }

  override decodeTrace(buffer: Uint8Array): any[] {
    const entryProto = WindowManagerServiceDumpProto.decode(buffer);

    // This parser is prone to accepting invalid inputs because it lacks a magic
    // number. Let's reduce the chances of accepting invalid inputs by making
    // sure that a trace entry can actually be created from the decoded proto.
    // If the trace entry creation fails, an exception is thrown and the parser
    // will be considered unsuited for this input data.
    this.processDecodedEntry(0, entryProto);

    return [entryProto];
  }

  override getTimestamp(type: TimestampType, entryProto: any): undefined|Timestamp {
    if (type !== TimestampType.ELAPSED) {
      return undefined;
    }
    return new Timestamp(TimestampType.ELAPSED, 0n);
  }

  override processDecodedEntry(index: number, entryProto: any): WindowManagerState {
    return WindowManagerState.fromProto(entryProto);
  }
}

export {ParserWindowManagerDump};
