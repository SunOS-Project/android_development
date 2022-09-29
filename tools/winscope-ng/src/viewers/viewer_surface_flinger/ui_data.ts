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
import { Tree, TreeSummary } from "viewers/common/tree_utils";
import { UserOptions } from "viewers/common/user_options";
import { Layer } from "common/trace/flickerlib/common";
import { TraceType } from "common/trace/trace_type";

export class UiData {
  dependencies: Array<TraceType> = [TraceType.SURFACE_FLINGER];
  rects?: Rectangle[] = [];
  displayIds?: number[] = [];
  highlightedItems?: Array<string> = [];
  pinnedItems?: Array<Tree> = [];
  hierarchyUserOptions?: UserOptions = {};
  propertiesUserOptions?: UserOptions = {};
  tree?:  Tree | null = null;
  selectedTree?: any = {};
  selectedLayer?: Layer = {};
  selectedTreeSummary?: TreeSummary = [];
}

export interface Rectangle {
  topLeft: Point;
  bottomRight: Point;
  label: string;
  transform: RectTransform | null;
  height: number;
  width: number;
  isVisible: boolean;
  isDisplay: boolean;
  ref: any;
  id: number;
  displayId: number;
  isVirtual: boolean;
}

export interface Point {
  x: number,
  y: number
}

export interface RectTransform {
  matrix?: RectMatrix;
  dsdx?: number;
  dsdy?: number;
  dtdx?: number;
  dtdy?: number;
  tx?: number;
  ty?: number;
}

export interface RectMatrix {
  dsdx: number;
  dsdy: number;
  dtdx: number;
  dtdy: number;
  tx: number;
  ty: number;
}
