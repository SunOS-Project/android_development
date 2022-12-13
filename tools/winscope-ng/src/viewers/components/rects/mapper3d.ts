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

import {Rectangle} from "viewers/common/rectangle";
import {Box3D, ColorType, Label3D, Point3D, Rect3D, Scene3D, Transform3D} from "./types3d";

class Mapper3D {
  private static readonly CAMERA_ROTATION_FACTOR_INIT = 1;
  private static readonly Z_SPACING_FACTOR_INIT = 1;
  private static readonly Z_SPACING_MAX = 200;
  private static readonly LABEL_FIRST_Y_OFFSET = 100;
  private static readonly LABEL_TEXT_Y_SPACING = 200;
  private static readonly LABEL_CIRCLE_RADIUS = 15;
  private static readonly ZOOM_FACTOR_INIT = 1;
  private static readonly ZOOM_FACTOR_MIN = 0.1;
  private static readonly ZOOM_FACTOR_MAX = 8.5;
  private static readonly ZOOM_FACTOR_STEP = 0.2;

  private rects: Rectangle[] = [];
  private highlightedRectIds: number[] = [];
  private cameraRotationFactor = Mapper3D.CAMERA_ROTATION_FACTOR_INIT;
  private zSpacingFactor = Mapper3D.Z_SPACING_FACTOR_INIT;
  private zoomFactor = Mapper3D.ZOOM_FACTOR_INIT;
  private showOnlyVisibleMode = false; // by default show all
  private showVirtualMode = false; // by default don't show virtual displays
  private currentDisplayId = 0; // default stack id is usually 0

  setRects(rects: Rectangle[]) {
    this.rects = rects;
  }

  setHighlightedRectIds(ids: number[]) {
    this.highlightedRectIds = ids;
  }

  getCameraRotationFactor(): number {
    return this.cameraRotationFactor;
  }

  setCameraRotationFactor(factor: number) {
    this.cameraRotationFactor = Math.min(Math.max(factor, 0), 1);
  }

  getZSpacingFactor(): number {
    return this.zSpacingFactor;
  }

  setZSpacingFactor(factor: number) {
    this.zSpacingFactor = Math.min(Math.max(factor, 0), 1);
  }

  increaseZoomFactor() {
    this.zoomFactor += Mapper3D.ZOOM_FACTOR_STEP;
    this.zoomFactor = Math.min(this.zoomFactor, Mapper3D.ZOOM_FACTOR_MAX);
  }

  decreaseZoomFactor() {
    this.zoomFactor -= Mapper3D.ZOOM_FACTOR_STEP;
    this.zoomFactor = Math.max(this.zoomFactor, Mapper3D.ZOOM_FACTOR_MIN);
  }

  resetCamera() {
    this.cameraRotationFactor = Mapper3D.CAMERA_ROTATION_FACTOR_INIT;
    this.zSpacingFactor = Mapper3D.Z_SPACING_FACTOR_INIT;
    this.zoomFactor = Mapper3D.ZOOM_FACTOR_INIT;
  }

  getShowOnlyVisibleMode(): boolean {
    return this.showOnlyVisibleMode;
  }

  setShowOnlyVisibleMode(enabled: boolean) {
    this.showOnlyVisibleMode = enabled;
  }

  getShowVirtualMode(): boolean {
    return this.showVirtualMode;
  }

  setShowVirtualMode(enabled: boolean) {
    this.showVirtualMode = enabled;
  }

  getCurrentDisplayId(): number {
    return this.currentDisplayId;
  }

  setCurrentDisplayId(id: number) {
    this.currentDisplayId = id;
  }

  computeScene(): Scene3D {
    const rects2d = this.selectRectsToDraw(this.rects);
    const rects3d = this.computeRects(rects2d);
    const labels3d = this.computeLabels(rects2d, rects3d);
    const boundingBox = this.computeBoundingBox(rects3d, labels3d);

    const scene: Scene3D = {
      boundingBox: boundingBox,
      camera: {
        rotationFactor: this.cameraRotationFactor,
        zoomFactor: this.zoomFactor
      },
      rects: rects3d,
      labels: labels3d
    };

    return scene;
  }

  private selectRectsToDraw(rects: Rectangle[]): Rectangle[] {
    rects = rects.filter(rect => rect.displayId == this.currentDisplayId);

    if (this.showOnlyVisibleMode) {
      rects = rects.filter(rect => rect.isVisible || rect.isDisplay);
    }

    if (!this.showVirtualMode) {
      rects = rects.filter(rect => !rect.isVirtual);
    }

    return rects;
  }

  private computeRects(rects2d: Rectangle[]): Rect3D[] {
    let visibleRectsSoFar = 0;
    let visibleRectsTotal = 0;
    let nonVisibleRectsSoFar = 0;
    let nonVisibleRectsTotal = 0;

    rects2d.forEach(rect => {
      if (rect.isVisible) {
        ++visibleRectsTotal;
      } else {
        ++nonVisibleRectsTotal;
      }
    });

    let z = 0;

    const displays = rects2d.filter((rect2d) => rect2d.isDisplay);
    // Arbitrary max size for a rect (2x the maximum display)
    let maxDimension = Number.MAX_VALUE;

    if (displays.length > 0) {
      maxDimension = Math.max(
        ...displays.map((rect2d): number => Math.max(rect2d.width, rect2d.height))
      ) * 2;
    }

    const rects3d = rects2d.map((rect2d): Rect3D => {
      const identity: Transform3D = {
        dsdx: 1,
        dsdy: 0,
        tx: 0,
        dtdx: 0,
        dtdy: 1,
        ty: 0
      };

      let center: Point3D = {
        x: rect2d.topLeft.x + rect2d.width / 2,
        y: rect2d.topLeft.y + rect2d.height / 2,
        z: z
      };

      z -= Mapper3D.Z_SPACING_MAX * this.zSpacingFactor;

      const darkFactor = rect2d.isVisible ?
        (visibleRectsTotal - visibleRectsSoFar++) / visibleRectsTotal :
        (nonVisibleRectsTotal - nonVisibleRectsSoFar++) / nonVisibleRectsTotal;


      let colorType: ColorType;
      if (this.highlightedRectIds.includes(rect2d.id)) {
        colorType = ColorType.HIGHLIGHTED;
      } else if (rect2d.isVisible) {
        colorType = ColorType.VISIBLE;
      } else {
        colorType = ColorType.NOT_VISIBLE;
      }

      let transform: Transform3D;
      if (rect2d.transform?.matrix) {
        transform = {
          dsdx: rect2d.transform.matrix.dsdx,
          dsdy: rect2d.transform.matrix.dsdy,
          tx: rect2d.transform.matrix.tx,
          dtdx: rect2d.transform.matrix.dtdx,
          dtdy: rect2d.transform.matrix.dtdy,
          ty: rect2d.transform.matrix.ty,
        };
      } else {
        transform = identity;
      }

      let height = rect2d.height;
      let width = rect2d.width;

      // Crop oversized rectangles (e.g. BackColorSurface to make it easier to see elements)
      if (width > maxDimension && height > maxDimension) {
        width = maxDimension;
        height = maxDimension;
        // centralize the new rect
        center = {
          x: maxDimension / 4,
          y: 0,
          z: center.z
        };
      }

      return {
        id: rect2d.id,
        center: center,
        width: width,
        height: height,
        darkFactor: darkFactor,
        colorType: colorType,
        isClickable: rect2d.isClickable,
        transform: transform,
      };
    });

    return rects3d;
  }

  private computeLabels(rects2d: Rectangle[], rects3d: Rect3D[]): Label3D[] {
    const labels3d: Label3D[] = [];

    let labelY = Math.max(...rects3d.map(rect => {
      const bottomRight = {
        x: rect.center.x + rect.width / 2,
        y: rect.center.y + rect.height / 2,
        z: rect.center.z,
      };
      return this.matMultiply(rect.transform, bottomRight).y;
    })) + Mapper3D.LABEL_FIRST_Y_OFFSET;

    rects2d.forEach((rect2d, index) => {
      if (!rect2d.label) {
        return;
      }

      const rect3d = rects3d[index];

      const lineStarts = [
        this.matMultiply(rect3d.transform, {
          x: rect3d.center.x - rect3d.width / 2,
          y: rect3d.center.y,
          z: rect3d.center.z
        }),
        this.matMultiply(rect3d.transform, {
          x: rect3d.center.x + rect3d.width / 2,
          y: rect3d.center.y,
          z: rect3d.center.z
        }),
        this.matMultiply(rect3d.transform, {
          x: rect3d.center.x,
          y: rect3d.center.y - rect3d.width / 2,
          z: rect3d.center.z
        }),
        this.matMultiply(rect3d.transform, {
          x: rect3d.center.x,
          y: rect3d.center.y + rect3d.width / 2,
          z: rect3d.center.z
        })
      ];
      let maxIndex = 0;
      for (var i = 1; i < lineStarts.length; i++) {
        if (lineStarts[i].x > lineStarts[maxIndex].x) {
          maxIndex = i;
        }
      }
      const lineStart = lineStarts[maxIndex];
      lineStart.x += Mapper3D.LABEL_CIRCLE_RADIUS / 2;

      const lineEnd: Point3D = {
        x: lineStart.x,
        y: labelY,
        z: lineStart.z
      };

      const isHighlighted = this.highlightedRectIds.includes(rect2d.id);

      const label3d: Label3D = {
        circle: {
          radius: Mapper3D.LABEL_CIRCLE_RADIUS,
          center: {
            x: lineStart.x,
            y: lineStart.y,
            z: lineStart.z + 0.5,
          },
        },
        linePoints: [lineStart, lineEnd],
        textCenter: lineEnd,
        text: rect2d.label,
        isHighlighted: isHighlighted,
        rectId: rect2d.id
      };
      labels3d.push(label3d);

      labelY += Mapper3D.LABEL_TEXT_Y_SPACING;
    });

    return labels3d;
  }

  private matMultiply(mat: Transform3D, point: Point3D): Point3D {
    return {
      x: mat.dsdx * point.x + mat.dsdy * point.y + mat.tx,
      y: mat.dtdx * point.x + mat.dtdy * point.y + mat.ty,
      z: point.z,
    };
  }

  private computeBoundingBox(rects: Rect3D[], labels: Label3D[]): Box3D {
    if (rects.length == 0) {
      return {
        width: 1,
        height: 1,
        depth: 1,
        center: {x: 0, y: 0, z: 0},
        diagonal: Math.sqrt(3)
      };
    }

    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let minY = Number.MAX_VALUE;
    let maxY = Number.MIN_VALUE;
    let minZ = Number.MAX_VALUE;
    let maxZ = Number.MIN_VALUE;

    const updateMinMaxCoordinates = (point: Point3D) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    };

    rects.forEach(rect => {
      const topLeft: Point3D = {
        x: rect.center.x - rect.width / 2,
        y: rect.center.y + rect.height / 2,
        z: rect.center.z
      };
      const bottomRight: Point3D = {
        x: rect.center.x + rect.width / 2,
        y: rect.center.y - rect.height / 2,
        z: rect.center.z
      };
      updateMinMaxCoordinates(topLeft);
      updateMinMaxCoordinates(bottomRight);
    });

    labels.forEach(label => {
      label.linePoints.forEach(point => {
        updateMinMaxCoordinates(point);
      });
    });

    const center: Point3D = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    };

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;

    return {
      width: width,
      height: height,
      depth: depth,
      center: center,
      diagonal: Math.sqrt(width * width + height * height + depth * depth)
    };
  }
}

export {Mapper3D};
