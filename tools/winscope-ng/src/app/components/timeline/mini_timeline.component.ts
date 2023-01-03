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

import { Component, ElementRef, EventEmitter, HostListener, Input, Output, SimpleChanges, ViewChild } from "@angular/core";
import { TimelineData } from "app/timeline_data";
import { Timestamp } from "common/trace/timestamp";
import { TraceType } from "common/trace/trace_type";
import { MiniCanvasDrawer, MiniCanvasDrawerInput } from "./mini_canvas_drawer";

@Component({
  selector: "mini-timeline",
  template: `
    <div id="mini-timeline-wrapper" #miniTimelineWrapper>
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [`
    #mini-timeline-wrapper {
      width: 100%;
      min-height: 5em;
      height: 100%;
    }
  `]
})
export class MiniTimelineComponent {
  @Input() timelineData!: TimelineData;
  @Input() currentTimestamp!: Timestamp;
  @Input() selectedTraces!: TraceType[];

  @Output() changeTimestamp = new EventEmitter<Timestamp>();
  @Output() changeSeekTimestamp = new EventEmitter<Timestamp|undefined>();

  @ViewChild("miniTimelineWrapper", {static: false}) miniTimelineWrapper!: ElementRef;
  @ViewChild("canvas", {static: false}) canvasRef!: ElementRef;
  get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private drawer: MiniCanvasDrawer|undefined = undefined;

  ngAfterViewInit(): void {
    this.makeHiPPICanvas();

    const updateTimestampCallback = (position: bigint) => {
      const timestampType = this.timelineData.getTimestampType()!;
      this.changeSeekTimestamp.emit(undefined);
      this.changeTimestamp.emit(new Timestamp(timestampType, position));
    };

    this.drawer = new MiniCanvasDrawer(
      this.canvas,
      () => this.getMiniCanvasDrawerInput(),
      (position) => {
        const timestampType = this.timelineData.getTimestampType()!;
        this.changeSeekTimestamp.emit(new Timestamp(timestampType, position));
      },
      updateTimestampCallback,
      (selection) => {
        const timestampType = this.timelineData.getTimestampType()!;
        this.timelineData.setSelectionRange({
          from: new Timestamp(timestampType, selection.from),
          to: new Timestamp(timestampType, selection.to)
        });
      },
      updateTimestampCallback
    );
    this.drawer.draw();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.drawer !== undefined) {
      this.drawer.draw();
    }
  }

  private getMiniCanvasDrawerInput() {
    return new MiniCanvasDrawerInput(
      {
        from: this.timelineData.getFullRange().from.getValueNs(),
        to: this.timelineData.getFullRange().to.getValueNs()
      },
      this.currentTimestamp.getValueNs(),
      {
        from: this.timelineData.getSelectionRange().from.getValueNs(),
        to: this.timelineData.getSelectionRange().to.getValueNs()
      },
      this.getTimelinesToShow()
    );
  }

  private getTimelinesToShow() {
    const timelines = new Map<TraceType, bigint[]>();
    for (const type of this.selectedTraces) {
      timelines.set(type, this.timelineData.getTimelines().get(type)!.map(it => it.getValueNs()));
    }
    return timelines;
  }

  private makeHiPPICanvas() {
    // Reset any size before computing new size to avoid it interfering with size computations
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.style.width = "auto";
    this.canvas.style.height = "auto";

    const width = this.miniTimelineWrapper.nativeElement.offsetWidth;
    const height = this.miniTimelineWrapper.nativeElement.offsetHeight;

    const HiPPIwidth = window.devicePixelRatio * width;
    const HiPPIheight = window.devicePixelRatio * height;

    this.canvas.width = HiPPIwidth;
    this.canvas.height = HiPPIheight;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    // ensure all drawing operations are scaled
    if (window.devicePixelRatio !== 1) {
      const context = this.canvas.getContext("2d")!;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: Event) {
    this.makeHiPPICanvas();
    this.drawer?.draw();
  }
}