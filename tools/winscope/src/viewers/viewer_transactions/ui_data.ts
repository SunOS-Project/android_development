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
import {PropertiesTreeNode} from 'viewers/common/ui_tree_utils';

class UiData {
  constructor(
    public allVSyncIds: string[],
    public allPids: string[],
    public allUids: string[],
    public allTypes: string[],
    public allIds: string[],
    public entries: UiDataEntry[],
    public currentEntryIndex: undefined | number,
    public selectedEntryIndex: undefined | number,
    public scrollToIndex: undefined | number,
    public currentPropertiesTree: undefined | PropertiesTreeNode
  ) {}

  static EMPTY = new UiData([], [], [], [], [], [], undefined, undefined, undefined, undefined);
}

class UiDataEntry {
  constructor(
    public originalIndexInTraceEntry: number,
    public time: string,
    public vsyncId: number,
    public pid: string,
    public uid: string,
    public type: string,
    public id: string,
    public what: string,
    public propertiesTree?: PropertiesTreeNode
  ) {}
}

class UiDataEntryType {
  static DISPLAY_ADDED = 'DISPLAY_ADDED';
  static DISPLAY_REMOVED = 'DISPLAY_REMOVED';
  static DISPLAY_CHANGED = 'DISPLAY_CHANGED';
  static LAYER_ADDED = 'LAYER_ADDED';
  static LAYER_REMOVED = 'LAYER_REMOVED';
  static LAYER_CHANGED = 'LAYER_CHANGED';
  static LAYER_HANDLE_REMOVED = 'LAYER_HANDLE_REMOVED';
}

export {UiData, UiDataEntry, UiDataEntryType};
