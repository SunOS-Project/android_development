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
import { Component, Input, Inject, ElementRef } from "@angular/core";
import { UserOptions } from "viewers/common/user_options";
import { ViewerEvents } from "viewers/common/viewer_events";
import { PropertiesTree, TreeSummary, Terminal } from "viewers/common/tree_utils";
import { Layer } from "common/trace/flickerlib/common";

@Component({
  selector: "properties-view",
  template: `
    <mat-card-header class="view-header">
      <mat-card-title class="title-filter">
        <span class="properties-title">Properties</span>
        <mat-form-field class="filter-field">
          <mat-label>Filter...</mat-label>
          <input
            matInput
            [(ngModel)]="filterString"
            (ngModelChange)="filterTree()"
            name="filter"
          />
        </mat-form-field>
      </mat-card-title>
      <div class="view-controls">
        <mat-checkbox
          *ngFor="let option of objectKeys(userOptions)"
          class="trace-box"
          [(ngModel)]="userOptions[option].enabled"
          (ngModelChange)="updateTree()"
          [matTooltip]="userOptions[option].tooltip ?? ''"
        >{{userOptions[option].name}}</mat-checkbox>
      </div>
      <div *ngIf="objectKeys(selectedLayer).length > 0 && propertyGroups" class="element-summary">
        <property-groups
          [item]="selectedLayer"
          [summary]="summary"
        ></property-groups>
      </div>
    </mat-card-header>
    <mat-card-content class="properties-content" [style]="maxPropertiesHeight()">
      <div class="tree-wrapper">
        <tree-view
          class="tree-view"
          [item]="selectedTree"
          [showNode]="showNode"
          [isLeaf]="isLeaf"
          *ngIf="objectKeys(selectedTree).length > 0"
          [isPropertiesTree]="true"
          [isAlwaysCollapsed]="true"
        ></tree-view>
      </div>
    </mat-card-content>
  `,
  styles: [
    `
      .view-header {
        display: block;
        width: 100%;
        min-height: 3.75rem;
        align-items: center;
        border-bottom: 1px solid lightgrey;
      }

      .title-filter {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
      }

      .properties-title {
        font-size: 16px;
      }

      .filter-field {
        font-size: 16px;
        transform: scale(0.7);
        right: 0px;
        position: absolute
      }

      .view-controls {
        display: inline-block;
        font-size: 12px;
        font-weight: normal;
        margin-left: 5px
      }

      .properties-content{
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x:hidden
      }

      .element-summary {
        padding: 1rem;
        border-bottom: thin solid rgba(0,0,0,.12);
      }

      .element-summary .key {
        font-weight: 500;
      }

      .element-summary .value {
        color: rgba(0, 0, 0, 0.75);
      }

      .tree-view {
        white-space: pre-line;
        flex: 1 0 0;
        height: 100%;
        overflow-y: auto
      }
    `,
  ],
})

export class PropertiesComponent {
  objectKeys = Object.keys;
  filterString = "";

  @Input() userOptions: UserOptions = {};
  @Input() selectedTree: PropertiesTree = {};
  @Input() selectedLayer: Layer = {};
  @Input() propertyGroups = false;
  @Input() summary?: TreeSummary = [];

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef,
  ) {}

  maxPropertiesHeight() {
    const headerHeight = this.elementRef.nativeElement.querySelector(".view-header").clientHeight;
    return {
      height: `${800 - headerHeight}px`
    };
  }

  filterTree() {
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.PropertiesFilterChange,
      {
        bubbles: true,
        detail: { filterString: this.filterString }
      });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  updateTree() {
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.PropertiesUserOptionsChange,
      {
        bubbles: true,
        detail: { userOptions: this.userOptions }
      });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  showNode(item: any) {
    return !(item instanceof Terminal)
    && !(item.name instanceof Terminal)
    && !(item.propertyKey instanceof Terminal);
  }

  isLeaf(item: any) {
    return !item.children || item.children.length === 0
          || item.children.filter((c: any) => !(c instanceof Terminal)).length === 0;
  }
}
