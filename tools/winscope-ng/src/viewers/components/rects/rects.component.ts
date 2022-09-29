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
import { Component, Input, OnChanges, OnDestroy, Inject, ElementRef, SimpleChanges, OnInit } from "@angular/core";
import { RectsUtils } from "viewers/components/rects/rects_utils";
import { Point, Rectangle, RectMatrix, RectTransform } from "viewers/viewer_surface_flinger/ui_data";
import { CanvasGraphics } from "viewers/components/rects/canvas_graphics";
import * as THREE from "three";
import { ViewerEvents } from "viewers/common/viewer_events";

@Component({
  selector: "rects-view",
  template: `
    <mat-card-header class="view-controls">
      <mat-card-title><span>Layers</span></mat-card-title>
      <div class="top-view-controls">
        <div class="top-view-controls">
          <mat-checkbox
            class="rects-checkbox control-item"
            [checked]="visibleView()"
            (change)="onChangeView($event.checked!)"
          >Only visible</mat-checkbox>
          <mat-checkbox
            [disabled]="!visibleView()"
            class="rects-checkbox control-item"
            [checked]="showVirtualDisplays()"
            (change)="updateVirtualDisplays($event.checked!)"
          >Show virtual</mat-checkbox>
          <div class="zoom-container control-item">
            <button class="zoom-btn" (click)="updateZoom(true)">
              <mat-icon aria-hidden="true">
                zoom_in
              </mat-icon>
            </button>
            <button class="zoom-btn" (click)="updateZoom(false)">
              <mat-icon aria-hidden="true">
                zoom_out
              </mat-icon>
            </button>
          </div>
        </div>
      </div>
      <div class="slider-view-controls">
        <div class="slider" [class.rotation]="true">
          <span class="slider-label">Rotation</span>
          <mat-slider
            step="0.01"
            min="0"
            max="4"
            aria-label="units"
            [value]="xCameraPos()"
            (input)="updateRotation($event.value!)"
          ></mat-slider>
        </div>
        <div class="slider" [class.spacing]="true">
          <span class="slider-label">Spacing</span>
          <mat-slider
            class="spacing-slider"
            step="0.001"
            min="0.1"
            max="0.4"
            aria-label="units"
            [value]="getLayerSeparation()"
            (input)="updateLayerSeparation($event.value!)"
          ></mat-slider>
        </div>
      </div>
    </mat-card-header>
    <mat-card-content class="rects-content">
      <div class="canvas-container">
        <canvas class="rects-canvas" (click)="onRectClick($event)">
        </canvas>
      </div>
      <div class="tabs" *ngIf="displayIds.length > 1">
        <button mat-raised-button *ngFor="let displayId of displayIds" (click)="changeDisplayId(displayId)">{{displayId}}</button>
      </div>
    </mat-card-content>
  `,
  styles: [
    "@import 'https://fonts.googleapis.com/icon?family=Material+Icons';",
    ".rects-content {position: relative}",
    ".canvas-container {height: 40rem; width: 100%; position: relative}",
    ".rects-canvas {height: 40rem; width: 100%; cursor: pointer; position: absolute; top: 0px}",
    ".labels-canvas {height: 40rem; width: 100%; position: absolute; top: 0px}",
    ".view-controls {display: inline-block; position: relative; min-height: 4rem; width: 100%;}",
    ".slider-view-controls {display: inline-block; position: relative; height: 3rem; width: 100%;}",
    ".slider {display: inline-block}",
    ".slider.spacing {float: right}",
    ".slider span, .slider mat-slider { display: block; padding-left: 0px; padding-top:  0px; font-weight: bold}",
    ".top-view-controls {height: 3rem; width: 100%; position: relative; display: inline-block; vertical-align: middle;}",
    ".zoom-container {position: relative; vertical-align: middle; float: right}",
    ".zoom-btn {position:relative; display: inline-flex; background: none; border: none; padding: 0}",
    "mat-card-title {font-size: 16px !important; font-weight: medium; font-family: inherit;}",
    ":host /deep/ .mat-card-header-text {width: 100%; margin: 0;}",
    "mat-radio-group {vertical-align: middle}",
    "mat-radio-button {font-size: 16px; font-weight: normal}",
    ".mat-radio-button, .mat-radio-button-frame {transform: scale(0.8);}",
    ".rects-checkbox {font-size: 14px; font-weight: normal}",
    "mat-icon {margin: 5px}",
    "mat-checkbox {margin-left: 5px;}",
    ".mat-checkbox .mat-checkbox-frame { transform: scale(0.7);}",
    ".mat-checkbox-checked .mat-checkbox-background {transform: scale(0.7);}",
    ".mat-checkbox-indeterminate .mat-checkbox-background {transform: scale(0.7);}",
    ".slider-label {position: absolute; top: 0}",
    ".control-item {position: relative; display: inline-block;vertical-align: middle;align-items: center;}"
  ]
})

export class RectsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() rects!: Rectangle[];
  @Input() displayIds: Array<number> = [];
  @Input() highlightedItems: Array<string> = [];

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef,
  ) {
    this.canvasGraphics = new CanvasGraphics();
    this.currentDisplayId = this.displayIds[0] ?? 0; //default stack id is usually zero
  }

  ngOnInit() {
    window.addEventListener("resize", () => this.refreshCanvas());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["displayIds"]) {
      if (!this.displayIds.includes(this.currentDisplayId)) {
        this.currentDisplayId = this.displayIds[0];
      }
    }
    if (changes["highlightedItems"]) {
      this.canvasGraphics.updateHighlightedItems(this.highlightedItems);
    }
    if (this.rects.length > 0) {
      //change in rects so they must undergo transformation and scaling before canvas refreshed
      this.canvasGraphics.clearLabelElements();
      this.rects = this.rects.filter(rect => rect.isVisible || rect.isDisplay);
      this.displayRects = this.rects.filter(rect => rect.isDisplay);
      this.computeBounds();
      this.rects = this.rects.map(rect => {
        if (changes["rects"] && rect.transform) {
          return RectsUtils.transformRect(rect.transform.matrix ??  rect.transform, rect);
        } else {
          return rect;
        }
      });
      this.scaleRects();
      this.drawRects();
    }
  }

  ngOnDestroy() {
    window.removeEventListener("resize", () => this.refreshCanvas());
  }

  onRectClick(event:MouseEvent) {
    this.setNormalisedMousePos(event);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(this.mouse, this.canvasGraphics.getCamera());
    // create an array containing all objects in the scene with which the ray intersects
    const intersects = raycaster.intersectObjects(this.canvasGraphics.getTargetObjects());
    // if there is one (or more) intersections
    if (intersects.length > 0){
      const id = intersects[0].object.name;
      this.updateHighlightedItems(id);
    }
  }

  setNormalisedMousePos(event:MouseEvent) {
    event.preventDefault();
    const canvas = (event.target as Element);
    const canvasOffset = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX-canvasOffset.left)/canvas.clientWidth) * 2 - 1;
    this.mouse.y = -((event.clientY-canvasOffset.top)/canvas.clientHeight) * 2 + 1;
    this.mouse.z = 0;
  }

  updateHighlightedItems(newId: string) {
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.HighlightedChange,
      {
        bubbles: true,
        detail: { id: newId }
      });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  drawRects() {
    const canvas = this.elementRef.nativeElement.querySelector(".rects-canvas") as HTMLCanvasElement;
    this.canvasGraphics.initialise(canvas);
    this.refreshCanvas();
  }

  refreshCanvas() {
    this.updateVariablesBeforeRefresh();
    this.canvasGraphics.refreshCanvas();
  }

  updateVariablesBeforeRefresh() {
    const rects = this.rects.filter(rect => rect.displayId === this.currentDisplayId);
    this.canvasGraphics.updateRects(rects);
    const biggestX = Math.max(...this.rects.map(rect => rect.topLeft.x + rect.width/2));
    this.canvasGraphics.updateIsLandscape(biggestX > this.s({x: this.boundsWidth, y:this.boundsHeight}).x/2);
  }

  onChangeView(visible: boolean) {
    this.canvasGraphics.updateVisibleView(visible);
    this.canvasGraphics.clearLabelElements();
    this.refreshCanvas();
  }

  scaleRects() {
    this.rects = this.rects.map(rect => {
      rect.bottomRight = this.s(rect.bottomRight);
      rect.topLeft = this.s(rect.topLeft);
      rect.height = Math.abs(rect.topLeft.y - rect.bottomRight.y);
      rect.width = Math.abs(rect.bottomRight.x - rect.topLeft.x);
      const mat = this.getMatrix(rect);
      if (mat) {
        const newTranslation = this.s({x: mat.tx!, y: mat.ty!});
        mat.tx = newTranslation.x;
        mat.ty = newTranslation.y;
      }
      return rect;
    });
  }

  computeBounds(): any {
    this.boundsWidth = Math.max(...this.rects.map((rect) => {
      const mat = this.getMatrix(rect);
      if (mat) {
        return RectsUtils.transformRect(mat, rect).width;
      } else {
        return rect.width;
      }}));
    this.boundsHeight = Math.max(...this.rects.map((rect) => {
      const mat = this.getMatrix(rect);
      if (mat) {
        return RectsUtils.transformRect(mat, rect).height;
      } else {
        return rect.height;
      }}));

    if (this.displayRects.length > 0) {
      this.boundsWidth = Math.min(this.boundsWidth, this.maxWidth());
      this.boundsHeight = Math.min(this.boundsHeight, this.maxHeight());
    }
  }

  maxWidth() {
    return Math.max(...this.displayRects.map(rect => rect.width)) * 1.2;
  }

  maxHeight() {
    return Math.max(...this.displayRects.map(rect => rect.height)) * 1.2;
  }

  // scales coordinates to canvas
  s(sourceCoordinates: Point) {
    let scale;
    if (this.boundsWidth < this.boundsHeight) {
      scale = this.canvasGraphics.cameraHalfHeight*2 * 0.6 / this.boundsHeight;
    } else {
      scale = this.canvasGraphics.cameraHalfWidth*2 * 0.6 / this.boundsWidth;
    }
    return {
      x: sourceCoordinates.x * scale,
      y: sourceCoordinates.y * scale,
    };
  }

  getMatrix(rect: Rectangle) {
    if (rect.transform) {
      let matrix: RectTransform | RectMatrix = rect.transform;
      if (rect.transform && rect.transform.matrix) {
        matrix = rect.transform.matrix;
      }
      return matrix;
    } else {
      return false;
    }
  }

  visibleView() {
    return this.canvasGraphics.getVisibleView();
  }

  getLayerSeparation() {
    return this.canvasGraphics.getLayerSeparation();
  }

  updateLayerSeparation(sep: number) {
    this.canvasGraphics.updateLayerSeparation(sep);
    this.refreshCanvas();
  }

  updateRotation(rot: number) {
    this.canvasGraphics.updateRotation(rot);
    this.refreshCanvas();
  }

  updateZoom(zoom: boolean) {
    this.canvasGraphics.updateZoom(zoom);
    this.refreshCanvas();
  }

  updateVirtualDisplays(show: boolean) {
    this.canvasGraphics.updateVirtualDisplays(show);
    this.refreshCanvas();
  }

  xCameraPos() {
    return this.canvasGraphics.getXCameraPos();
  }

  showVirtualDisplays() {
    return this.canvasGraphics.getShowVirtualDisplays();
  }

  changeDisplayId(displayId: number) {
    this.currentDisplayId = displayId;
    this.refreshCanvas();
  }

  canvasGraphics: CanvasGraphics;
  private boundsWidth = 0;
  private boundsHeight = 0;
  private displayRects!: Rectangle[];
  private mouse = new THREE.Vector3(0, 0, 0);
  private currentDisplayId: number;
}
