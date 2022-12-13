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

import { Injectable, Type } from "@angular/core";
import {Timestamp, TimestampType} from "common/trace/timestamp";
import {TraceType} from "common/trace/trace_type";
import { ArrayUtils } from "common/utils/array_utils";
import { TimeRange } from "./components/timeline/utils";

type TimestampWithIndex = {index: number, timestamp: Timestamp};
@Injectable()
export class TimelineCoordinator {
  private timelines = new Map<TraceType, Timestamp[]>();
  private explicitlySetTimestamp: undefined|Timestamp = undefined;
  private timestampType: undefined|TimestampType = undefined;
  private observers = new Set<TimestampChangeObserver>();
  private explicitlySetSelection: TimeRange|undefined = undefined;
  private videoData: Blob|undefined = undefined;
  private screenRecordingTimeMapping: Map<Timestamp, number>|undefined = undefined;
  // The trace type the currently active view depends on
  private activeTraceTypes: TraceType[] = [];

  get currentTimestamp(): Timestamp|undefined {
    if (this.explicitlySetTimestamp === undefined) {
      if (this.timelines.size === 0) {
        return undefined;
      }
      if (this.activeTraceTypes.length === 0) {
        return this.getFirstTimestamp();
      }
      return this.getFirstTimestampOfActiveTraces();
    } else {
      return this.explicitlySetTimestamp;
    }
  }

  private getFirstTimestampOfActiveTraces(): Timestamp|undefined {
    if (this.activeTraceTypes.length === 0) {
      return undefined;
    }
    const activeTimestamps = this.activeTraceTypes.map(it => this.timelines.get(it)!).flatMap(it => it).sort();
    if (activeTimestamps.length === 0) {
      return undefined;
    }
    return activeTimestamps[0];
  }

  public setActiveTraceTypes(types: TraceType[]) {
    this.applyOperationAndNotifyObserversIfTimestampChanged(() => {
      this.activeTraceTypes = types;
    });
  }

  public getActiveTraceTypes(): TraceType[] {
    return this.activeTraceTypes;
  }

  public getTimestampType(): TimestampType|undefined {
    return this.timestampType;
  }

  public getActiveTimestampFor(type: TraceType): TimestampWithIndex|undefined {
    if (this.currentTimestamp === undefined) {
      return undefined;
    }
    return this.getActiveTimestampForTraceAt(type, this.currentTimestamp);
  }

  public getActiveTimestampForTraceAt(type: TraceType, timestamp: Timestamp): TimestampWithIndex|undefined {
    if (timestamp.getType() !== this.timestampType) {
      throw Error("Invalid timestampt type");
    }

    const timeline = this.timelines.get(type);
    if (timeline === undefined) {
      throw Error(`No timeline for requested trace type ${type}`);
    }
    const index = ArrayUtils.binarySearchLowerOrEqual(timeline, timestamp);
    if (index === undefined) {
      return undefined;
    }
    return { index, timestamp: timeline[index] };
  }

  get fullRange() {
    return {
      from: this.getAllTimestamps()[0],
      to: this.getAllTimestamps()[this.getAllTimestamps().length - 1]
    };
  }

  get selection(): TimeRange {
    if (this.explicitlySetSelection === undefined) {
      return this.fullRange;
    } else {
      return this.explicitlySetSelection;
    }
  }

  public setSelection(selection: TimeRange) {
    this.explicitlySetSelection = selection;
  }

  public getTimelines() {
    return this.timelines;
  }

  public registerObserver(observer: TimestampChangeObserver) {
    this.observers.add(observer);
    observer.onCurrentTimestampChanged(this.currentTimestamp);
  }

  public unregisterObserver(observer: TimestampChangeObserver) {
    this.observers.delete(observer);
  }

  public setTimelines(timelines: Timeline[]) {
    const allTimestamps = timelines.flatMap(timeline => timeline.timestamps);
    if (allTimestamps.some(timestamp => timestamp.getType() != allTimestamps[0].getType())) {
      throw Error("Added timeline has inconsistent timestamps.");
    }

    if (allTimestamps.length > 0) {
      this.timestampType = allTimestamps[0].getType();
    }

    this.timelines.clear();
    timelines.forEach(timeline => {
      this.timelines.set(timeline.traceType, timeline.timestamps);
    });

    this.notifyOfTimestampUpdate();
  }

  public removeTimeline(typeToRemove: TraceType) {
    this.applyOperationAndNotifyObserversIfTimestampChanged(() => {
      this.timelines.delete(typeToRemove);
      this.activeTraceTypes = this.activeTraceTypes.filter(type => type != typeToRemove);
    });
  }

  public setScreenRecordingData(videoData: Blob, timeMapping: Map<Timestamp, number>) {
    this.videoData = videoData;
    this.screenRecordingTimeMapping = timeMapping;
  }

  public removeScreenRecordingData() {
    this.videoData = undefined;
    this.screenRecordingTimeMapping = undefined;
  }

  public getVideoData(): Blob|undefined {
    return this.videoData;
  }

  public updateCurrentTimestamp(timestamp: Timestamp|undefined) {
    if (this.getAllTimestamps().length === 0) {
      console.warn("Setting timestamp on traces with no timestamps/entries...");
      return;
    }

    if (timestamp !== undefined) {
      if (this.timestampType === undefined) {
        throw Error("Timestamp type wasn't set before calling updateCurrentTimestamp");
      }
      if (timestamp.getType() !== this.timestampType) {
        throw Error("Timeline based on different timestamp type");
      }
    }

    this.applyOperationAndNotifyObserversIfTimestampChanged(() => {
      this.explicitlySetTimestamp = timestamp;
    });
  }

  public getAllTimestamps(): Timestamp[] {
    return Array.from(this.timelines.values()).flatMap(num => num).sort();
  }

  private getFirstTimestamp(): Timestamp|undefined {
    if (this.getAllTimestamps().length === 0) {
      return undefined;
    }

    return this.getAllTimestamps()[0];
  }

  public getPreviousTimestampFor(traceType: TraceType): Timestamp|undefined {
    const activeIndex = this.getActiveTimestampFor(traceType)?.index;
    if (activeIndex === undefined) {
      // Only acceptable reason for this to be undefined is if we are before the first entry for this type
      if (this.timelines.get(traceType)!.length === 0 ||
          this.currentTimestamp!.getValueNs() < this.timelines.get(traceType)![0].getValueNs()) {
        return undefined;
      }
      throw Error(`Missing active timestamp for trace type ${traceType}`);
    }

    const previousIndex = activeIndex - 1;
    if (previousIndex < 0) {
      return undefined;
    }

    return this.timelines.get(traceType)?.[previousIndex];
  }

  public getNextTimestampFor(traceType: TraceType): Timestamp|undefined {
    const activeIndex = this.getActiveTimestampFor(traceType)?.index ?? -1;
    if (this.timelines.get(traceType)?.length == 0 ?? true) {
      throw Error(`Missing active timestamp for trace type ${traceType}`);
    }

    const timestamps = this.timelines.get(traceType);
    if (timestamps === undefined) {
      throw Error("Timestamps for tracetype not found");
    }
    const nextIndex = activeIndex + 1;
    if (nextIndex >= (timestamps.length)) {
      return undefined;
    }

    return timestamps[nextIndex];
  }

  public timestampAsElapsedScreenrecordingSeconds(timestamp: Timestamp): number|undefined {
    const latestScreenRecordingEntry = this.getActiveTimestampForTraceAt(TraceType.SCREEN_RECORDING, timestamp)?.timestamp;
    if (latestScreenRecordingEntry === undefined) {
      return undefined;
    }

    return this.screenRecordingTimeMapping!.get(latestScreenRecordingEntry);
  }

  public clearData() {
    this.applyOperationAndNotifyObserversIfTimestampChanged(() => {
      this.timelines.clear();
      this.explicitlySetTimestamp = undefined;
      this.timestampType = undefined;
      this.explicitlySetSelection = undefined;
      this.videoData = undefined;
      this.screenRecordingTimeMapping = new Map<Timestamp, number>();
      this.activeTraceTypes = [];
    });
  }

  public moveToPreviousEntryFor(type: TraceType) {
    const prevTimestamp = this.getPreviousTimestampFor(type);
    if (prevTimestamp !== undefined) {
      this.updateCurrentTimestamp(prevTimestamp);
    }
  }

  public moveToNextEntryFor(type: TraceType) {
    const nextTimestamp = this.getNextTimestampFor(type);
    if (nextTimestamp !== undefined) {
      this.updateCurrentTimestamp(nextTimestamp);
    }
  }

  private applyOperationAndNotifyObserversIfTimestampChanged(op: () => void) {
    const prevTimestamp = this.currentTimestamp;
    op();
    if (prevTimestamp !== this.currentTimestamp) {
      this.notifyOfTimestampUpdate();
    }
  }

  private notifyOfTimestampUpdate() {
    const timestamp = this.currentTimestamp;
    this.observers.forEach(observer =>
      observer.onCurrentTimestampChanged(timestamp));
  }
}

export interface Timeline {
  traceType: TraceType;
  timestamps: Timestamp[];
}

export interface TimestampChangeObserver {
  onCurrentTimestampChanged(timestamp: undefined|Timestamp): void;
}
