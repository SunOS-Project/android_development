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

import {ArrayUtils} from 'common/array_utils';
import {assertDefined} from 'common/assert_utils';
import {TimeUtils} from 'common/time_utils';
import {ObjectFormatter} from 'trace/flickerlib/ObjectFormatter';
import {Trace, TraceEntry} from 'trace/trace';
import {Traces} from 'trace/traces';
import {TraceEntryFinder} from 'trace/trace_entry_finder';
import {TracePosition} from 'trace/trace_position';
import {TraceType} from 'trace/trace_type';
import {PropertiesTreeGenerator} from 'viewers/common/properties_tree_generator';
import {PropertiesTreeNode} from 'viewers/common/ui_tree_utils';
import {UiData, UiDataEntry, UiDataEntryType} from './ui_data';

export class Presenter {
  private trace: Trace<object>;
  private entry?: TraceEntry<object>;
  private originalIndicesOfUiDataEntries: number[];
  private uiData = UiData.EMPTY;
  private readonly notifyUiDataCallback: (data: UiData) => void;
  private static readonly VALUE_NA = 'N/A';
  private vsyncIdFilter: string[] = [];
  private pidFilter: string[] = [];
  private uidFilter: string[] = [];
  private typeFilter: string[] = [];
  private idFilter: string[] = [];
  private whatSearchString = '';

  constructor(traces: Traces, notifyUiDataCallback: (data: UiData) => void) {
    this.trace = assertDefined(traces.getTrace(TraceType.TRANSACTIONS));
    this.notifyUiDataCallback = notifyUiDataCallback;
    this.originalIndicesOfUiDataEntries = [];
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onTracePositionUpdate(position: TracePosition) {
    this.entry = TraceEntryFinder.findCorrespondingEntry(this.trace, position);

    this.uiData.currentEntryIndex = this.computeCurrentEntryIndex();
    this.uiData.selectedEntryIndex = undefined;
    this.uiData.scrollToIndex = this.uiData.currentEntryIndex;
    this.uiData.currentPropertiesTree = this.computeCurrentPropertiesTree(
      this.uiData.entries,
      this.uiData.currentEntryIndex,
      this.uiData.selectedEntryIndex
    );

    this.notifyUiDataCallback(this.uiData);
  }

  onVSyncIdFilterChanged(vsyncIds: string[]) {
    this.vsyncIdFilter = vsyncIds;
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onPidFilterChanged(pids: string[]) {
    this.pidFilter = pids;
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onUidFilterChanged(uids: string[]) {
    this.uidFilter = uids;
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onTypeFilterChanged(types: string[]) {
    this.typeFilter = types;
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onIdFilterChanged(ids: string[]) {
    this.idFilter = ids;
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onWhatSearchStringChanged(searchString: string) {
    this.whatSearchString = searchString;
    this.computeUiData();
    this.notifyUiDataCallback(this.uiData);
  }

  onEntryClicked(index: number) {
    if (this.uiData.selectedEntryIndex === index) {
      this.uiData.selectedEntryIndex = undefined; // remove selection when clicked again
    } else {
      this.uiData.selectedEntryIndex = index;
    }

    this.uiData.scrollToIndex = undefined; // no scrolling

    this.uiData.currentPropertiesTree = this.computeCurrentPropertiesTree(
      this.uiData.entries,
      this.uiData.currentEntryIndex,
      this.uiData.selectedEntryIndex
    );

    this.notifyUiDataCallback(this.uiData);
  }

  private computeUiData() {
    const entries = this.makeUiDataEntries();

    const allVSyncIds = this.getUniqueUiDataEntryValues(entries, (entry: UiDataEntry) =>
      entry.vsyncId.toString()
    );
    const allPids = this.getUniqueUiDataEntryValues(entries, (entry: UiDataEntry) => entry.pid);
    const allUids = this.getUniqueUiDataEntryValues(entries, (entry: UiDataEntry) => entry.uid);
    const allTypes = this.getUniqueUiDataEntryValues(entries, (entry: UiDataEntry) => entry.type);
    const allIds = this.getUniqueUiDataEntryValues(entries, (entry: UiDataEntry) => entry.id);

    let filteredEntries = entries;

    if (this.vsyncIdFilter.length > 0) {
      filteredEntries = filteredEntries.filter((entry) =>
        this.vsyncIdFilter.includes(entry.vsyncId.toString())
      );
    }

    if (this.pidFilter.length > 0) {
      filteredEntries = filteredEntries.filter((entry) => this.pidFilter.includes(entry.pid));
    }

    if (this.uidFilter.length > 0) {
      filteredEntries = filteredEntries.filter((entry) => this.uidFilter.includes(entry.uid));
    }

    if (this.typeFilter.length > 0) {
      filteredEntries = filteredEntries.filter((entry) => this.typeFilter.includes(entry.type));
    }

    if (this.idFilter.length > 0) {
      filteredEntries = filteredEntries.filter((entry) => this.idFilter.includes(entry.id));
    }

    filteredEntries = filteredEntries.filter((entry) => entry.what.includes(this.whatSearchString));

    this.originalIndicesOfUiDataEntries = filteredEntries.map(
      (entry) => entry.originalIndexInTraceEntry
    );

    const currentEntryIndex = this.computeCurrentEntryIndex();
    const selectedEntryIndex = undefined;
    const currentPropertiesTree = this.computeCurrentPropertiesTree(
      filteredEntries,
      currentEntryIndex,
      selectedEntryIndex
    );

    this.uiData = new UiData(
      allVSyncIds,
      allPids,
      allUids,
      allTypes,
      allIds,
      filteredEntries,
      currentEntryIndex,
      selectedEntryIndex,
      currentEntryIndex,
      currentPropertiesTree
    );
  }

  private computeCurrentEntryIndex(): undefined | number {
    if (!this.entry) {
      return undefined;
    }

    if (this.originalIndicesOfUiDataEntries.length === 0) {
      return undefined;
    }

    return (
      ArrayUtils.binarySearchFirstGreaterOrEqual(
        this.originalIndicesOfUiDataEntries,
        this.entry.getIndex()
      ) ?? this.originalIndicesOfUiDataEntries.length - 1
    );
  }

  private computeCurrentPropertiesTree(
    entries: UiDataEntry[],
    currentEntryIndex: undefined | number,
    selectedEntryIndex: undefined | number
  ): undefined | PropertiesTreeNode {
    if (selectedEntryIndex !== undefined) {
      return entries[selectedEntryIndex].propertiesTree;
    }
    if (currentEntryIndex !== undefined) {
      return entries[currentEntryIndex].propertiesTree;
    }
    return undefined;
  }

  private makeUiDataEntries(): UiDataEntry[] {
    const treeGenerator = new PropertiesTreeGenerator();
    const entries: UiDataEntry[] = [];
    const formattingOptions = ObjectFormatter.displayDefaults;
    ObjectFormatter.displayDefaults = false;

    this.trace.forEachEntry((entry, originalIndex) => {
      const timestampType = entry.getTimestamp().getType();
      const entryProto = entry.getValue() as any;
      const realToElapsedTimeOffsetNs = entryProto.realToElapsedTimeOffsetNs;

      for (const transactionStateProto of entryProto.transactions) {
        for (const layerStateProto of transactionStateProto.layerChanges) {
          entries.push(
            new UiDataEntry(
              originalIndex,
              TimeUtils.format(entry.getTimestamp()),
              Number(entryProto.vsyncId),
              transactionStateProto.pid.toString(),
              transactionStateProto.uid.toString(),
              UiDataEntryType.LAYER_CHANGED,
              layerStateProto.layerId.toString(),
              layerStateProto.what,
              treeGenerator.generate('LayerState', ObjectFormatter.format(layerStateProto))
            )
          );
        }

        for (const displayStateProto of transactionStateProto.displayChanges) {
          entries.push(
            new UiDataEntry(
              originalIndex,
              TimeUtils.format(entry.getTimestamp()),
              Number(entryProto.vsyncId),
              transactionStateProto.pid.toString(),
              transactionStateProto.uid.toString(),
              UiDataEntryType.DISPLAY_CHANGED,
              displayStateProto.id.toString(),
              displayStateProto.what,
              treeGenerator.generate('DisplayState', ObjectFormatter.format(displayStateProto))
            )
          );
        }
      }

      for (const layerCreationArgsProto of entryProto.addedLayers) {
        entries.push(
          new UiDataEntry(
            originalIndex,
            TimeUtils.format(entry.getTimestamp()),
            Number(entryProto.vsyncId),
            Presenter.VALUE_NA,
            Presenter.VALUE_NA,
            UiDataEntryType.LAYER_ADDED,
            layerCreationArgsProto.layerId.toString(),
            '',
            treeGenerator.generate(
              'LayerCreationArgs',
              ObjectFormatter.format(layerCreationArgsProto)
            )
          )
        );
      }

      for (const removedLayerId of entryProto.removedLayers) {
        entries.push(
          new UiDataEntry(
            originalIndex,
            TimeUtils.format(entry.getTimestamp()),
            Number(entryProto.vsyncId),
            Presenter.VALUE_NA,
            Presenter.VALUE_NA,
            UiDataEntryType.LAYER_REMOVED,
            removedLayerId.toString(),
            '',
            treeGenerator.generate('RemovedLayerId', ObjectFormatter.format(removedLayerId))
          )
        );
      }

      for (const displayStateProto of entryProto.addedDisplays) {
        entries.push(
          new UiDataEntry(
            originalIndex,
            TimeUtils.format(entry.getTimestamp()),
            Number(entryProto.vsyncId),
            Presenter.VALUE_NA,
            Presenter.VALUE_NA,
            UiDataEntryType.DISPLAY_ADDED,
            displayStateProto.id.toString(),
            displayStateProto.what,
            treeGenerator.generate('DisplayState', ObjectFormatter.format(displayStateProto))
          )
        );
      }

      for (const removedDisplayId of entryProto.removedDisplays) {
        entries.push(
          new UiDataEntry(
            originalIndex,
            TimeUtils.format(entry.getTimestamp()),
            Number(entryProto.vsyncId),
            Presenter.VALUE_NA,
            Presenter.VALUE_NA,
            UiDataEntryType.DISPLAY_REMOVED,
            removedDisplayId.toString(),
            '',
            treeGenerator.generate('RemovedDisplayId', ObjectFormatter.format(removedDisplayId))
          )
        );
      }

      for (const removedLayerHandleId of entryProto.removedLayerHandles) {
        entries.push(
          new UiDataEntry(
            originalIndex,
            TimeUtils.format(entry.getTimestamp()),
            Number(entryProto.vsyncId),
            Presenter.VALUE_NA,
            Presenter.VALUE_NA,
            UiDataEntryType.LAYER_HANDLE_REMOVED,
            removedLayerHandleId.toString(),
            '',
            treeGenerator.generate(
              'RemovedLayerHandleId',
              ObjectFormatter.format(removedLayerHandleId)
            )
          )
        );
      }
    });

    ObjectFormatter.displayDefaults = formattingOptions;

    return entries;
  }

  private getUniqueUiDataEntryValues<T>(
    entries: UiDataEntry[],
    getValue: (entry: UiDataEntry) => T
  ): T[] {
    const uniqueValues = new Set<T>();
    entries.forEach((entry: UiDataEntry) => {
      uniqueValues.add(getValue(entry));
    });

    const result = [...uniqueValues];

    result.sort((a, b) => {
      const aIsNumber = !isNaN(Number(a));
      const bIsNumber = !isNaN(Number(b));

      if (aIsNumber && bIsNumber) {
        return Number(a) - Number(b);
      } else if (aIsNumber) {
        return 1; // place number after strings in the result
      } else if (bIsNumber) {
        return -1; // place number after strings in the result
      }

      // a and b are both strings
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      } else {
        return 0;
      }
    });

    return result;
  }
}
