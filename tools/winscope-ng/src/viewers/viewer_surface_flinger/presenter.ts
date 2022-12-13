
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
import { UiData } from "./ui_data";
import { Rectangle, RectMatrix, RectTransform } from "viewers/common/rectangle";
import { TraceType } from "common/trace/trace_type";
import { TreeUtils, FilterType } from "common/utils/tree_utils";
import { UserOptions } from "viewers/common/user_options";
import { HierarchyTreeNode, PropertiesTreeNode } from "viewers/common/ui_tree_utils";
import { TreeGenerator } from "viewers/common/tree_generator";
import { TreeTransformer } from "viewers/common/tree_transformer";
import { Layer, LayerTraceEntry } from "common/trace/flickerlib/common";

type NotifyViewCallbackType = (uiData: UiData) => void;

export class Presenter {
  constructor(notifyViewCallback: NotifyViewCallbackType) {
    this.notifyViewCallback = notifyViewCallback;
    this.uiData = new UiData([TraceType.SURFACE_FLINGER]);
    this.notifyViewCallback(this.uiData);
  }

  public updatePinnedItems(pinnedItem: HierarchyTreeNode) {
    const pinnedId = `${pinnedItem.id}`;
    if (this.pinnedItems.map(item => `${item.id}`).includes(pinnedId)) {
      this.pinnedItems = this.pinnedItems.filter(pinned => `${pinned.id}` != pinnedId);
    } else {
      this.pinnedItems.push(pinnedItem);
    }
    this.updatePinnedIds(pinnedId);
    this.uiData.pinnedItems = this.pinnedItems;
    this.notifyViewCallback(this.uiData);
  }

  public updateHighlightedItems(id: string) {
    if (this.highlightedItems.includes(id)) {
      this.highlightedItems = this.highlightedItems.filter(hl => hl != id);
    } else {
      this.highlightedItems = []; //if multi-select surfaces implemented, remove this line
      this.highlightedItems.push(id);
    }
    this.uiData.highlightedItems = this.highlightedItems;
    this.notifyViewCallback(this.uiData);
  }

  public updateHierarchyTree(userOptions: UserOptions) {
    this.hierarchyUserOptions = userOptions;
    this.uiData.hierarchyUserOptions = this.hierarchyUserOptions;
    this.uiData.tree = this.generateTree();
    this.notifyViewCallback(this.uiData);
  }

  public filterHierarchyTree(filterString: string) {
    this.hierarchyFilter = TreeUtils.makeNodeFilter(filterString);
    this.uiData.tree = this.generateTree();
    this.notifyViewCallback(this.uiData);
  }

  public updatePropertiesTree(userOptions: UserOptions) {
    this.propertiesUserOptions = userOptions;
    this.uiData.propertiesUserOptions = this.propertiesUserOptions;
    this.updateSelectedTreeUiData();
  }

  public filterPropertiesTree(filterString: string) {
    this.propertiesFilter = TreeUtils.makeNodeFilter(filterString);
    this.updateSelectedTreeUiData();
  }

  public newPropertiesTree(selectedItem: HierarchyTreeNode) {
    this.selectedHierarchyTree = selectedItem;
    this.updateSelectedTreeUiData();
  }

  public notifyCurrentTraceEntries(entries: Map<TraceType, [any, any]>) {
    this.uiData = new UiData();
    this.uiData.hierarchyUserOptions = this.hierarchyUserOptions;
    this.uiData.propertiesUserOptions = this.propertiesUserOptions;

    const sfEntries = entries.get(TraceType.SURFACE_FLINGER);
    if (sfEntries) {
      [this.entry, this.previousEntry] = sfEntries;
      if (this.entry) {
        this.uiData.highlightedItems = this.highlightedItems;
        this.uiData.rects = this.generateRects();
        this.uiData.displayIds = this.displayIds;
        this.uiData.tree = this.generateTree();
      }
    }
    this.notifyViewCallback(this.uiData);
  }

  private generateRects(): Rectangle[] {
    const displayRects = this.entry.displays.map((display: any) => {
      const rect = display.layerStackSpace;
      rect.label = `Display`;
      if (display.name) {
        rect.label += ` - ${display.name}`;
      }
      rect.id = display.id;
      rect.displayId = display.layerStackId;
      rect.isDisplay = true;
      rect.isVirtual = display.isVirtual ?? false;
      rect.transform = {
        matrix: display.transform.matrix
      };
      return rect;
    }) ?? [];
    this.displayIds = [];
    const rects = this.entry.visibleLayers
      .sort((layer1: any, layer2: any) => {
        const absZLayer1 = layer1.zOrderPath;
        const absZLayer2 = layer2.zOrderPath;
        var elA, elB, i, len;
        for (i = 0, len = Math.min(absZLayer1.length, absZLayer2.length); i < len; i++) {
          elA = absZLayer1[i];
          elB = absZLayer2[i];
          if (elA > elB) return -1;
          if (elA < elB) return 1;
        }
        return absZLayer2.length - absZLayer1.length;
      })
      .map((it: any) => {
        const rect = it.rect;
        rect.displayId = it.stackId;
        if (!this.displayIds.includes(it.stackId)) {
          this.displayIds.push(it.stackId);
        }
        rect.transform = {
          matrix: rect.transform.matrix
        };
        return rect;
      });
    return this.rectsToUiData(rects.concat(displayRects));
  }

  private updateSelectedTreeUiData() {
    if (this.selectedHierarchyTree) {
      this.uiData.propertiesTree = this.getTreeWithTransformedProperties(this.selectedHierarchyTree);
      this.uiData.selectedLayer = this.selectedLayer;
    }
    this.notifyViewCallback(this.uiData);
  }

  private generateTree() {
    if (!this.entry) {
      return null;
    }

    const generator = new TreeGenerator(this.entry, this.hierarchyFilter, this.pinnedIds)
      .setIsOnlyVisibleView(this.hierarchyUserOptions["onlyVisible"]?.enabled)
      .setIsSimplifyNames(this.hierarchyUserOptions["simplifyNames"]?.enabled)
      .setIsFlatView(this.hierarchyUserOptions["flat"]?.enabled)
      .withUniqueNodeId();
    let tree: HierarchyTreeNode | null;
    if (!this.hierarchyUserOptions["showDiff"]?.enabled) {
      tree = generator.generateTree();
    } else {
      tree = generator.compareWith(this.previousEntry)
        .withModifiedCheck()
        .generateFinalTreeWithDiff();
    }
    this.pinnedItems = generator.getPinnedItems();
    this.uiData.pinnedItems = this.pinnedItems;
    return tree;
  }

  private rectsToUiData(rects: any[]): Rectangle[] {
    const uiRects: Rectangle[] = [];
    rects.forEach((rect: any) => {
      let t = null;
      if (rect.transform && rect.transform.matrix) {
        t = rect.transform.matrix;
      } else if (rect.transform) {
        t = rect.transform;
      }
      let transform: RectTransform | null = null;
      if (t !== null) {
        const matrix: RectMatrix = {
          dsdx: t.dsdx,
          dsdy: t.dsdy,
          dtdx: t.dtdx,
          dtdy: t.dtdy,
          tx: t.tx,
          ty: t.ty
        };
        transform = {
          matrix: matrix,
        };
      }

      const newRect: Rectangle = {
        topLeft: {x: rect.left, y: rect.top},
        bottomRight: {x: rect.right, y: rect.bottom},
        height: rect.height,
        width: rect.width,
        label: rect.label,
        transform: transform,
        isVisible: rect.ref?.isVisible ?? false,
        isDisplay: rect.isDisplay ?? false,
        ref: rect.ref,
        id: rect.id ?? rect.ref.id,
        displayId: rect.displayId ?? rect.ref.stackId,
        isVirtual: rect.isVirtual ?? false,
        isClickable: !(rect.isDisplay ?? false)
      };
      uiRects.push(newRect);
    });
    return uiRects;
  }

  private updatePinnedIds(newId: string) {
    if (this.pinnedIds.includes(newId)) {
      this.pinnedIds = this.pinnedIds.filter(pinned => pinned != newId);
    } else {
      this.pinnedIds.push(newId);
    }
  }

  private getTreeWithTransformedProperties(selectedTree: HierarchyTreeNode): PropertiesTreeNode {
    const transformer = new TreeTransformer(selectedTree, this.propertiesFilter)
      .setOnlyProtoDump(true)
      .setIsShowDefaults(this.propertiesUserOptions["showDefaults"]?.enabled)
      .setIsShowDiff(this.propertiesUserOptions["showDiff"]?.enabled)
      .setTransformerOptions({skip: selectedTree.skip})
      .setProperties(this.entry)
      .setDiffProperties(this.previousEntry);
    this.selectedLayer = transformer.getOriginalFlickerItem(this.entry, selectedTree.stableId);
    const transformedTree = transformer.transform();
    return transformedTree;
  }

  private readonly notifyViewCallback: NotifyViewCallbackType;
  private uiData: UiData;
  private hierarchyFilter: FilterType = TreeUtils.makeNodeFilter("");
  private propertiesFilter: FilterType = TreeUtils.makeNodeFilter("");
  private highlightedItems: Array<string> = [];
  private displayIds: Array<number> = [];
  private pinnedItems: Array<HierarchyTreeNode> = [];
  private pinnedIds: Array<string> = [];
  private selectedHierarchyTree: HierarchyTreeNode | null = null;
  private selectedLayer: LayerTraceEntry | Layer | null = null;
  private previousEntry: LayerTraceEntry | null = null;
  private entry: LayerTraceEntry | null = null;
  private hierarchyUserOptions: UserOptions = {
    showDiff: {
      name: "Show diff",
      enabled: false
    },
    simplifyNames: {
      name: "Simplify names",
      enabled: true
    },
    onlyVisible: {
      name: "Only visible",
      enabled: false
    },
    flat: {
      name: "Flat",
      enabled: false
    }
  };

  private propertiesUserOptions: UserOptions = {
    showDiff: {
      name: "Show diff",
      enabled: false
    },
    showDefaults: {
      name: "Show defaults",
      enabled: false,
      tooltip: `
                If checked, shows the value of all properties.
                Otherwise, hides all properties whose value is
                the default for its data type.
              `
    },
  };
}
