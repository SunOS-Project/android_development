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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANYf KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {TracesBuilder} from 'test/unit/traces_builder';
import {TraceBuilder} from 'test/unit/trace_builder';
import {UnitTestUtils} from 'test/unit/utils';
import {Parser} from 'trace/parser';
import {RealTimestamp, TimestampType} from 'trace/timestamp';
import {Trace} from 'trace/trace';
import {Traces} from 'trace/traces';
import {TracePosition} from 'trace/trace_position';
import {TraceType} from 'trace/trace_type';
import {Presenter} from './presenter';
import {UiData, UiDataEntryType} from './ui_data';

describe('PresenterTransactions', () => {
  let parser: Parser<object>;
  let trace: Trace<object>;
  let traces: Traces;
  let presenter: Presenter;
  let outputUiData: undefined | UiData;
  const TOTAL_OUTPUT_ENTRIES = 1504;

  beforeAll(async () => {
    parser = await UnitTestUtils.getParser('traces/elapsed_and_real_timestamp/Transactions.pb');
  });

  beforeEach(() => {
    outputUiData = undefined;
    setUpTestEnvironment(TimestampType.ELAPSED);
  });

  it('is robust to empty trace', () => {
    const traces = new TracesBuilder().setEntries(TraceType.TRANSACTIONS, []).build();
    presenter = new Presenter(traces, (data: UiData) => {
      outputUiData = data;
    });

    expect(outputUiData).toEqual(UiData.EMPTY);

    presenter.onTracePositionUpdate(TracePosition.fromTimestamp(new RealTimestamp(10n)));
    expect(outputUiData).toEqual(UiData.EMPTY);
  });

  it('processes trace position update and computes output UI data', () => {
    presenter.onTracePositionUpdate(createTracePosition(0));

    expect(outputUiData!.allPids).toEqual([
      'N/A',
      '0',
      '515',
      '1593',
      '2022',
      '2322',
      '2463',
      '3300',
    ]);
    expect(outputUiData!.allUids).toEqual(['N/A', '1000', '1003', '10169', '10235', '10239']);
    expect(outputUiData!.allTypes).toEqual([
      'DISPLAY_CHANGED',
      'LAYER_ADDED',
      'LAYER_CHANGED',
      'LAYER_HANDLE_REMOVED',
      'LAYER_REMOVED',
    ]);
    expect(outputUiData!.allIds.length).toEqual(115);

    expect(outputUiData!.entries.length).toEqual(TOTAL_OUTPUT_ENTRIES);

    expect(outputUiData?.currentEntryIndex).toEqual(0);
    expect(outputUiData?.selectedEntryIndex).toBeUndefined();
    expect(outputUiData?.scrollToIndex).toEqual(0);
    expect(outputUiData?.currentPropertiesTree).toBeDefined();
  });

  it('processes trace position update and updates current entry and scroll position', () => {
    presenter.onTracePositionUpdate(createTracePosition(0));
    expect(outputUiData!.currentEntryIndex).toEqual(0);
    expect(outputUiData!.scrollToIndex).toEqual(0);

    presenter.onTracePositionUpdate(createTracePosition(10));
    expect(outputUiData!.currentEntryIndex).toEqual(13);
    expect(outputUiData!.scrollToIndex).toEqual(13);
  });

  it('filters entries according to VSYNC ID filter', () => {
    presenter.onVSyncIdFilterChanged([]);
    expect(outputUiData!.entries.length).toEqual(TOTAL_OUTPUT_ENTRIES);

    presenter.onVSyncIdFilterChanged(['1']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.vsyncId))).toEqual(new Set([1]));

    presenter.onVSyncIdFilterChanged(['1', '3', '10']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.vsyncId))).toEqual(
      new Set([1, 3, 10])
    );
  });

  it('filters entries according to PID filter', () => {
    presenter.onPidFilterChanged([]);
    expect(new Set(outputUiData!.entries.map((entry) => entry.pid))).toEqual(
      new Set(['N/A', '0', '515', '1593', '2022', '2322', '2463', '3300'])
    );

    presenter.onPidFilterChanged(['0']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.pid))).toEqual(new Set(['0']));

    presenter.onPidFilterChanged(['0', '515']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.pid))).toEqual(new Set(['0', '515']));
  });

  it('filters entries according to UID filter', () => {
    presenter.onUidFilterChanged([]);
    expect(new Set(outputUiData!.entries.map((entry) => entry.uid))).toEqual(
      new Set(['N/A', '1000', '1003', '10169', '10235', '10239'])
    );

    presenter.onUidFilterChanged(['1000']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.uid))).toEqual(new Set(['1000']));

    presenter.onUidFilterChanged(['1000', '1003']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.uid))).toEqual(
      new Set(['1000', '1003'])
    );
  });

  it('filters entries according to type filter', () => {
    presenter.onTypeFilterChanged([]);
    expect(new Set(outputUiData!.entries.map((entry) => entry.type))).toEqual(
      new Set([
        UiDataEntryType.DISPLAY_CHANGED,
        UiDataEntryType.LAYER_ADDED,
        UiDataEntryType.LAYER_CHANGED,
        UiDataEntryType.LAYER_REMOVED,
        UiDataEntryType.LAYER_HANDLE_REMOVED,
      ])
    );

    presenter.onTypeFilterChanged([UiDataEntryType.LAYER_ADDED]);
    expect(new Set(outputUiData!.entries.map((entry) => entry.type))).toEqual(
      new Set([UiDataEntryType.LAYER_ADDED])
    );

    presenter.onTypeFilterChanged([UiDataEntryType.LAYER_ADDED, UiDataEntryType.LAYER_REMOVED]);
    expect(new Set(outputUiData!.entries.map((entry) => entry.type))).toEqual(
      new Set([UiDataEntryType.LAYER_ADDED, UiDataEntryType.LAYER_REMOVED])
    );
  });

  it('filters entries according to ID filter', () => {
    presenter.onIdFilterChanged([]);
    expect(new Set(outputUiData!.entries.map((entry) => entry.id)).size).toBeGreaterThan(20);

    presenter.onIdFilterChanged(['1']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.id))).toEqual(new Set(['1']));

    presenter.onIdFilterChanged(['1', '3']);
    expect(new Set(outputUiData!.entries.map((entry) => entry.id))).toEqual(new Set(['1', '3']));
  });

  it('filters entries according to "what" search string', () => {
    expect(outputUiData!.entries.length).toEqual(TOTAL_OUTPUT_ENTRIES);

    presenter.onWhatSearchStringChanged('');
    expect(outputUiData!.entries.length).toEqual(TOTAL_OUTPUT_ENTRIES);

    presenter.onWhatSearchStringChanged('Crop');
    expect(outputUiData!.entries.length).toBeLessThan(TOTAL_OUTPUT_ENTRIES);

    presenter.onWhatSearchStringChanged('STRING_WITH_NO_MATCHES');
    expect(outputUiData!.entries.length).toEqual(0);
  });

  it('updates selected entry and properties tree when entry is clicked', () => {
    presenter.onTracePositionUpdate(createTracePosition(0));
    expect(outputUiData!.currentEntryIndex).toEqual(0);
    expect(outputUiData!.selectedEntryIndex).toBeUndefined();
    expect(outputUiData!.scrollToIndex).toEqual(0);
    expect(outputUiData!.currentPropertiesTree).toEqual(outputUiData!.entries[0].propertiesTree);

    presenter.onEntryClicked(10);
    expect(outputUiData!.currentEntryIndex).toEqual(0);
    expect(outputUiData!.selectedEntryIndex).toEqual(10);
    expect(outputUiData!.scrollToIndex).toBeUndefined(); // no scrolling
    expect(outputUiData!.currentPropertiesTree).toEqual(outputUiData!.entries[10].propertiesTree);

    // remove selection when selected entry is clicked again
    presenter.onEntryClicked(10);
    expect(outputUiData!.currentEntryIndex).toEqual(0);
    expect(outputUiData!.selectedEntryIndex).toBeUndefined();
    expect(outputUiData!.scrollToIndex).toBeUndefined(); // no scrolling
    expect(outputUiData!.currentPropertiesTree).toEqual(outputUiData!.entries[0].propertiesTree);
  });

  it('computes current entry index', () => {
    presenter.onTracePositionUpdate(createTracePosition(0));
    expect(outputUiData!.currentEntryIndex).toEqual(0);

    presenter.onTracePositionUpdate(createTracePosition(10));
    expect(outputUiData!.currentEntryIndex).toEqual(13);
  });

  it('updates current entry index when filters change', () => {
    presenter.onTracePositionUpdate(createTracePosition(10));

    presenter.onPidFilterChanged([]);
    expect(outputUiData!.currentEntryIndex).toEqual(13);

    presenter.onPidFilterChanged(['0']);
    expect(outputUiData!.currentEntryIndex).toEqual(10);

    presenter.onPidFilterChanged(['0', '515']);
    expect(outputUiData!.currentEntryIndex).toEqual(11);

    presenter.onPidFilterChanged(['0', '515', 'N/A']);
    expect(outputUiData!.currentEntryIndex).toEqual(13);
  });

  it('formats real time', () => {
    setUpTestEnvironment(TimestampType.REAL);
    expect(outputUiData!.entries[0].time).toEqual('2022-08-03T06:19:01.051480997');
  });

  it('formats elapsed time', () => {
    setUpTestEnvironment(TimestampType.ELAPSED);
    expect(outputUiData!.entries[0].time).toEqual('2s450ms981445ns');
  });

  const setUpTestEnvironment = (timestampType: TimestampType) => {
    trace = new TraceBuilder<object>().setParser(parser).setTimestampType(timestampType).build();

    traces = new Traces();
    traces.setTrace(TraceType.TRANSACTIONS, trace);

    presenter = new Presenter(traces, (data: UiData) => {
      outputUiData = data;
    });
  };

  const createTracePosition = (entryIndex: number): TracePosition => {
    return TracePosition.fromTraceEntry(trace.getEntry(entryIndex));
  };
});
