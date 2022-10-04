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
import ObjectFormatter from "common/trace/flickerlib/ObjectFormatter";

import {
  FilterType,
  PropertiesTreeNode,
  DiffType,
  Terminal,
  TreeNodeTrace,
  HierarchyTreeNode,
  PropertiesDump
} from "./tree_utils";

interface TransformOptions {
  freeze: boolean;
  keepOriginal: boolean;
  metadataKey: string | null;
}
interface TreeTransformerOptions {
  skip?: any;
  formatter?: any;
}

export class TreeTransformer {
  private stableId: string;
  private rootName: string;
  private isShowDefaults = false;
  private isShowDiff = false;
  private filter: FilterType;
  private properties: PropertiesDump | Terminal | null = null;
  private compareWithProperties: PropertiesDump | Terminal | null = null;
  private options?: TreeTransformerOptions;
  private onlyProtoDump = false;
  private transformOptions: TransformOptions = {
    keepOriginal: false, freeze: true, metadataKey: null,
  };

  constructor(selectedTree: HierarchyTreeNode, filter: FilterType) {
    this.stableId = this.compatibleStableId(selectedTree);
    this.rootName = selectedTree.name;
    this.filter = filter;
    this.setTransformerOptions({});
  }

  public showOnlyProtoDump(): TreeTransformer {
    this.onlyProtoDump = true;
    return this;
  }

  public setIsShowDefaults(enabled: boolean): TreeTransformer {
    this.isShowDefaults = enabled;
    return this;
  }

  public setIsShowDiff(enabled: boolean): TreeTransformer {
    this.isShowDiff = enabled;
    return this;
  }

  public setTransformerOptions(options: TreeTransformerOptions): TreeTransformer {
    this.options = options;
    if (!this.options.formatter) {
      this.options.formatter = this.formatProto;
    }
    return this;
  }

  public setProperties(currentEntry: TreeNodeTrace): TreeTransformer {
    const currFlickerItem = this.getOriginalFlickerItem(currentEntry, this.stableId);
    const target = currFlickerItem ? currFlickerItem.obj ?? currFlickerItem : null;
    ObjectFormatter.displayDefaults = this.isShowDefaults;
    this.properties = this.onlyProtoDump ? this.getProtoDumpPropertiesForDisplay(target) : this.getPropertiesForDisplay(target);
    return this;
  }

  public setDiffProperties(previousEntry: TreeNodeTrace  | null): TreeTransformer {
    if (this.isShowDiff) {
      const prevFlickerItem = this.findFlickerItem(previousEntry, this.stableId);
      const target = prevFlickerItem ? prevFlickerItem.obj ?? prevFlickerItem : null;
      this.compareWithProperties = this.onlyProtoDump ? this.getProtoDumpPropertiesForDisplay(target) : this.getPropertiesForDisplay(target);
    }
    return this;
  }

  public getOriginalFlickerItem(entry: TreeNodeTrace, stableId: string): TreeNodeTrace  | null {
    return this.findFlickerItem(entry, stableId);
  }

  private getProtoDumpPropertiesForDisplay(entry: TreeNodeTrace): PropertiesDump | null {
    if (!entry) {
      return null;
    }

    const obj: PropertiesDump = {};
    const proto = ObjectFormatter.format(entry.proto);
    if (proto) {
      Object.keys(proto).forEach((prop: string) => {
        obj[prop] = proto[prop] ?? "empty";

        if (Object.keys(obj[prop]).length === 0) {
          obj[prop]= "empty";
        }
      });
    }

    return obj;
  }

  private getPropertiesForDisplay(entry: TreeNodeTrace): PropertiesDump | null {
    if (!entry) {
      return null;
    }

    let obj: PropertiesDump = {};

    const properties = ObjectFormatter.getProperties(entry);
    properties.forEach(prop => {
      if (entry.get) obj[prop] = entry.get(prop);
    });
    if (obj["children"]) delete obj["children"];
    if (obj["proto"]) delete obj["proto"];

    obj["proto"] = Object.assign({}, entry.proto);
    if (obj["proto"].children) delete obj["proto"].children;
    if (obj["proto"].childWindows) delete obj["proto"].childWindows;
    if (obj["proto"].childrenWindows) delete obj["proto"].childrenWindows;
    if (obj["proto"].childContainers) delete obj["proto"].childContainers;
    if (obj["proto"].windowToken) delete obj["proto"].windowToken;
    if (obj["proto"].rootDisplayArea) delete obj["proto"].rootDisplayArea;
    if (obj["proto"].rootWindowContainer) delete obj["proto"].rootWindowContainer;
    if (obj["proto"].windowContainer?.children) delete obj["proto"].windowContainer.children;

    obj = ObjectFormatter.format(obj);

    Object.keys(obj["proto"]).forEach((prop: string) => {
      if (Object.keys(obj["proto"][prop]).length === 0) {
        obj["proto"][prop] = "empty";
      }
    });

    return obj;
  }

  private findFlickerItem(entryFlickerItem: TreeNodeTrace | null, stableId: string): TreeNodeTrace | null {
    if (!entryFlickerItem) {
      return null;
    }

    if (entryFlickerItem.stableId && entryFlickerItem.stableId === stableId) {
      return entryFlickerItem;
    }

    if (!entryFlickerItem.children) {
      return null;
    }

    for (const child of entryFlickerItem.children) {
      const foundEntry: any = this.findFlickerItem(child, stableId);
      if (foundEntry) {
        return foundEntry;
      }
    }

    return null;
  }


  public transform(): PropertiesTreeNode {
    const {formatter} = this.options!;
    if (!formatter) {
      throw new Error("Missing formatter, please set with setOptions()");
    }

    const transformedTree = this.transformTree(this.properties, this.rootName,
      this.compareWithProperties, this.rootName,
      this.stableId, this.transformOptions);
    return transformedTree;
  }

  private transformTree(
    properties: PropertiesDump | null | Terminal,
    name: string | Terminal,
    compareWithProperties: PropertiesDump | null | Terminal,
    compareWithName: string | Terminal,
    stableId: string,
    transformOptions: TransformOptions,
  ): PropertiesTreeNode {
    const originalProperties = properties;
    const metadata = this.getMetadata(
      originalProperties, transformOptions.metadataKey
    );

    const children: any[] = [];

    if (properties && !this.isTerminal(properties)) {
      const transformedProperties = this.transformProperties(properties, transformOptions.metadataKey);
      properties = transformedProperties.properties;
    }

    if (compareWithProperties && !this.isTerminal(compareWithProperties)) {
      const transformedProperties = this.transformProperties(
        compareWithProperties,
        transformOptions.metadataKey
      );
      compareWithProperties = transformedProperties.properties;
    }

    for (const key in properties) {
      if (!(properties instanceof Terminal) && properties[key]) {
        let compareWithChild = new Terminal();
        let compareWithChildName = new Terminal();
        if (compareWithProperties && !(compareWithProperties instanceof Terminal) && compareWithProperties[key]) {
          compareWithChild = compareWithProperties[key];
          compareWithChildName = key;
        }
        const child = this.transformTree(properties[key], key,
          compareWithChild, compareWithChildName,
          `${stableId}.${key}`, transformOptions);

        children.push(child);
      }
    }

    // Takes care of adding deleted items to final tree
    for (const key in compareWithProperties) {
      if (properties && !(properties instanceof Terminal) && !properties[key] &&
          !(compareWithProperties instanceof Terminal) && compareWithProperties[key]) {
        const child = this.transformTree(new Terminal(), new Terminal(),
          compareWithProperties[key], key,
          `${stableId}.${key}`, transformOptions);

        children.push(child);
      }
    }

    let transformedProperties: any;
    if (
      children.length == 1 &&
      children[0].children?.length == 0 &&
      !children[0].combined
    ) {
      // Merge leaf key value pairs.
      const child = children[0];

      transformedProperties = {
        kind: "",
        name: (this.isTerminal(name) ? compareWithName : name) + ": " + child.name,
        stableId,
        children: child.children,
        combined: true,
      };

      if (this.isShowDiff) {
        transformedProperties.diffType = child.diffType;
      }
    } else {
      transformedProperties = {
        kind: "",
        name,
        stableId,
        children,
      };

      if (this.isShowDiff) {
        const diffType = this.getDiff(name, compareWithName);
        transformedProperties.diffType = diffType;

        if (diffType == DiffType.DELETED) {
          transformedProperties.name = compareWithName;
        }
      }
    }

    if (transformOptions.keepOriginal) {
      transformedProperties.properties = originalProperties;
    }

    if (metadata && transformOptions.metadataKey) {
      transformedProperties[transformOptions.metadataKey] = metadata;
    }

    if (!this.isTerminal(transformedProperties.name)) {
      transformedProperties.propertyKey = this.getPropertyKey(transformedProperties);
      transformedProperties.propertyValue = this.getPropertyValue(transformedProperties);
    }

    if (!this.filterMatches(transformedProperties) &&
        !this.hasChildMatchingFilter(transformedProperties?.children)) {
      transformedProperties.propertyKey = new Terminal();
    }
    return transformOptions.freeze ? Object.freeze(transformedProperties) : transformedProperties;
  }

  private hasChildMatchingFilter(children: PropertiesTreeNode[] | null | undefined): boolean {
    if (!children || children.length === 0) return false;

    let match = false;
    for (let i=0; i<children.length; i++) {
      if (this.filterMatches(children[i]) || this.hasChildMatchingFilter(children[i].children)) {
        match = true;
      }
    }

    return match;
  }

  private getMetadata(obj: PropertiesDump | null | Terminal, metadataKey: string | null): any {
    if (obj == null) {
      return null;
    }
    if (metadataKey && !(obj instanceof Terminal) && obj[metadataKey]) {
      const metadata = obj[metadataKey];
      obj[metadataKey] = undefined;
      return metadata;
    } else {
      return null;
    }
  }

  private getPropertyKey(item: PropertiesDump): string {
    if (item["name"] && (!item["children"] || item["children"].length === 0)) {
      return item["name"].split(": ")[0];
    }
    return item["name"];
  }

  private getPropertyValue(item: PropertiesDump): string | null {
    if (item["name"] && (!item["children"] || item["children"].length === 0)) {
      return item["name"].split(": ").slice(1).join(": ");
    }
    return null;
  }


  private filterMatches(item: PropertiesDump | null): boolean {
    return this.filter(item) ?? false;
  }

  private transformProperties(properties: PropertiesDump, metadataKey: string | null): PropertiesTreeNode {
    const {skip, formatter} = this.options!;
    const transformedProperties: PropertiesTreeNode = {
      properties: {},
    };
    let formatted = undefined;

    if (skip && skip.includes(properties)) {
      // skip
    } else if ((formatted = formatter(properties))) {
      // Obj has been formatted into a terminal node — has no children.
      transformedProperties.properties[formatted] = new Terminal();
    } else if (Array.isArray(properties)) {
      properties.forEach((e, i) => {
        transformedProperties.properties["" + i] = e;
      });
    } else if (typeof properties == "string") {
      // Object is a primitive type — has no children. Set to terminal
      // to differentiate between null object and Terminal element.
      transformedProperties.properties[properties] = new Terminal();
    } else if (typeof properties == "number" || typeof properties == "boolean") {
      // Similar to above — primitive type node has no children.
      transformedProperties.properties["" + properties] = new Terminal();
    } else if (properties && typeof properties == "object") {
      Object.keys(properties).forEach((key) => {
        if (key === metadataKey) {
          return;
        }
        transformedProperties.properties[key] = properties[key];
      });
    } else if (properties === null) {
      // Null object has no children — set to be terminal node.
      transformedProperties.properties.null = new Terminal();
    }
    return transformedProperties;
  }

  private getDiff(val: string | Terminal, compareVal: string | Terminal): string {
    if (val && this.isTerminal(compareVal)) {
      return DiffType.ADDED;
    } else if (this.isTerminal(val) && compareVal) {
      return DiffType.DELETED;
    } else if (compareVal != val) {
      return DiffType.MODIFIED;
    } else {
      return DiffType.NONE;
    }
  }

  private compatibleStableId(item: HierarchyTreeNode): string {
    // For backwards compatibility
    // (the only item that doesn't have a unique stable ID in the tree)
    if (item.stableId === "winToken|-|") {
      return item.stableId + item.children[0].stableId;
    }
    return item.stableId;
  }

  private formatProto(item: any) {
    if (item?.prettyPrint) {
      return item.prettyPrint();
    }
  }

  private isTerminal(item: any): boolean {
    return item instanceof Terminal;
  }
}
