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
import { CommonModule } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RectsComponent } from "viewers/components/rects/rects.component";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDividerModule  } from "@angular/material/divider";
import { MatRadioModule } from "@angular/material/radio";
import { MatSliderModule } from "@angular/material/slider";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { Rectangle } from "viewers/common/rectangle";

describe("RectsComponent", () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let htmlElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatCheckboxModule,
        MatDividerModule,
        MatSliderModule,
        MatRadioModule
      ],
      declarations: [RectsComponent, TestHostComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    htmlElement = fixture.nativeElement;
    fixture.detectChanges();
  });

  it("can be created", () => {
    expect(component).toBeTruthy();
  });

  it("renders layer separation slider", () => {
    fixture.detectChanges();
    const slider = htmlElement.querySelector("mat-slider");
    expect(slider).toBeTruthy();
  });

  it("updates rendered layer separation when slider changes", () => {
    const slider = htmlElement.querySelector(".spacing-slider");
    spyOn(component.rectsComponent, "updateLayerSeparation");
    slider?.dispatchEvent(new MouseEvent("mousedown"));
    fixture.detectChanges();
    expect(component.rectsComponent.updateLayerSeparation).toHaveBeenCalled();
  });

  it("renders rects canvas", () => {
    fixture.detectChanges();
    const rectsCanvas = htmlElement.querySelector(".canvas-rects");
    expect(rectsCanvas).toBeTruthy();
  });

  it("refreshes canvas if rects are present", async () => {
    component.addRects([
      {
        topLeft: {x:0, y:0},
        bottomRight: {x:1, y:-1},
        label: "rectangle1",
        transform: {
          matrix: {
            dsdx: 1,
            dsdy: 0,
            dtdx: 0,
            dtdy: 1,
            tx: 0,
            ty: 0
          }
        },
        height: 1,
        width: 1,
        isVisible: true,
        isDisplay: false,
        ref: null,
        id: 12345,
        displayId: 0,
        isVirtual: false,
        isClickable: false
      }
    ]);
    spyOn(component.rectsComponent, "refreshCanvas").and.callThrough();
    fixture.detectChanges();
    expect(component.rectsComponent.refreshCanvas).toHaveBeenCalled();
  });

  @Component({
    selector: "host-component",
    template: "<rects-view [rects]=\"rects\"></rects-view>"
  })
  class TestHostComponent {
    public rects: Rectangle[] = [];

    addRects(newRects: Rectangle[]) {
      this.rects = newRects;
    }

    @ViewChild(RectsComponent)
    public rectsComponent!: RectsComponent;
  }
});
