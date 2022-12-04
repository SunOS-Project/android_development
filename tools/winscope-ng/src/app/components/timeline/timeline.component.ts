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

import {
  ChangeDetectorRef,
  Component,
  Input,
  Inject,
  ViewEncapsulation,
  Output,
  EventEmitter,
  ViewChild,
  HostListener,
  ElementRef,
} from "@angular/core";
import { FormControl, FormGroup, Validators} from "@angular/forms";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { TraceType } from "common/trace/trace_type";
import { TRACE_INFO } from "app/trace_info";
import { TimelineCoordinator, TimestampChangeObserver } from "app/timeline_coordinator";
import { MiniTimelineComponent } from "./mini_timeline.component";
import { Timestamp } from "common/trace/timestamp";
import { TimeUtils } from "common/utils/time_utils";

@Component({
  selector: "timeline",
  encapsulation: ViewEncapsulation.None,
  template: `
    <div id="expanded-nav" *ngIf="expanded">
        <div id="video-content" *ngIf="videoUrl !== undefined">
          <video
            *ngIf="videoCurrentTime !== undefined"
            id="video"
            [currentTime]="videoCurrentTime"
            [src]="videoUrl">
          </video>
          <div *ngIf="videoCurrentTime === undefined" class="no-video-message">
            <p>No screenrecording frame to show</p>
            <p>Current timestamp before first screenrecording frame.</p>
          </div>
        </div>
        <expanded-timeline
          [currentTimestamp]="currentTimestamp"
          (onTimestampChanged)="updateCurrentTimestamp($event)"
          id="expanded-timeline"
        ></expanded-timeline>
    </div>
    <div class="navbar" #collapsedTimeline>
      <ng-template [ngIf]="hasTimestamps()">
        <div id="time-selector">
            <button mat-icon-button
              id="prev_entry_button"
              color="primary"
              (click)="moveToPreviousEntry()"
              [disabled]="!hasPrevEntry()">
                <mat-icon>chevron_left</mat-icon>
            </button>
            <form [formGroup]="timestampForm" class="time-selector-form">
                <mat-form-field class="time-input" appearance="fill" (change)="inputTimeChanged($event)">
                    <input matInput name="humanTimeInput" [formControl]="selectedTimeFormControl" />
                </mat-form-field>
                <mat-form-field class="time-input" appearance="fill" (change)="inputTimeChanged($event)">
                    <input matInput name="nsTimeInput" [formControl]="selectedNsFormControl" />
                </mat-form-field>
            </form>
            <button mat-icon-button
              id="next_entry_button"
              color="primary"
              (click)="moveToNextEntry()"
              [disabled]="!hasNextEntry()">
                <mat-icon>chevron_right</mat-icon>
            </button>
        </div>
        <div id="trace-selector">
            <mat-form-field appearance="none">
                <mat-select #traceSelector [formControl]="selectedTracesFormControl" multiple (closed)="onTraceSelectionClosed()">
                  <div class="tip">
                    Select up to 2 additional traces to display.
                  </div>
                  <mat-option
                    *ngFor="let trace of availableTraces"
                    [value]="trace"
                    [style]="{
                      color: TRACE_INFO[trace].color,
                      opacity: isOptionDisabled(trace) ? 0.5 : 1.0
                    }"
                    [disabled]="isOptionDisabled(trace)"
                  >
                    <mat-icon>{{ TRACE_INFO[trace].icon }}</mat-icon>
                    {{ TRACE_INFO[trace].name }}
                  </mat-option>
                  <div class="actions">
                    <button mat-button color="primary" (click)="traceSelector.close()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="applyNewTraceSelection(); traceSelector.close()">Apply</button>
                  </div>
                  <mat-select-trigger class="shown-selection">
                    <mat-icon
                      *ngFor="let selectedTrace of selectedTraces"
                      [style]="{color: TRACE_INFO[selectedTrace].color}"
                    >
                      {{ TRACE_INFO[selectedTrace].icon }}
                    </mat-icon>
                  </mat-select-trigger>
                </mat-select>
            </mat-form-field>
        </div>
        <mini-timeline
          [currentTimestamp]="currentTimestamp"
          [selectedTraces]="selectedTraces"
          (changeTimestamp)="updateCurrentTimestamp($event)"
          (changeSeekTimestamp)="updateSeekTimestamp($event)"
          id="mini-timeline"
          #miniTimeline
        ></mini-timeline>
        <div id="toggle" *ngIf="hasTimestamps()">
            <button mat-icon-button
                    [class]="TOGGLE_BUTTON_CLASS"
                    color="primary"
                    aria-label="Toggle Expanded Timeline"
                    (click)="toggleExpand()">
                <mat-icon *ngIf="!expanded">expand_less</mat-icon>
                <mat-icon *ngIf="expanded">expand_more</mat-icon>
            </button>
        </div>
      </ng-template >
      <div *ngIf="!hasTimestamps()" class="no-timestamps-msg">
        <p class="mat-body-2">No timeline to show!</p>
        <p class="mat-body-1">All loaded traces contain no timestamps!</p>
      </div>
    </div>
`,
  styles: [`
    .navbar {
      display: flex;
      width: 100%;
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }
    #expanded-nav {
      display: flex;
      border-bottom: 1px solid #3333
    }
    #time-selector {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }
    .time-selector-form {
      display: flex;
      flex-direction: column;
      width: 15em;
    }
    .time-selector-form .time-input {
      width: 100%;
      margin-bottom: -1.34375em;
      text-align: center;
    }
    #mini-timeline {
      flex-grow: 1;
      align-self: stretch;
    }
    #video-content {
      position: relative;
      min-width: 20rem;
      min-height: 35rem;
      align-self: stretch;
      text-align: center;
      border: 2px solid black;
      flex-basis: 0px;
      flex-grow: 1;
      display: flex;
      align-items: center;
    }
    #video {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 100%;
    }
    #expanded-nav {
      display: flex;
      flex-direction: row;
    }
    #expanded-timeline {
      flex-grow: 1;
    }
    #trace-selector .mat-form-field-infix {
      width: 50px;
      padding: 0 0.75rem 0 0.5rem;
      border-top: unset;
    }
    #trace-selector .mat-icon {
      padding: 2px;
    }
    #trace-selector .shown-selection {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: auto;
    }
    #trace-selector .mat-select-trigger {
      height: unset;
    }
    #trace-selector .mat-form-field-wrapper {
      padding: 0;
    }
    .mat-select-panel {
      max-height: unset!important;
      font-family: 'Roboto', sans-serif;
    }
    .tip {
      padding: 1.5rem;
      font-weight: 200;
      border-bottom: solid 1px #DADCE0;
    }
    .actions {
      border-top: solid 1px #DADCE0;
      width: 100%;
      padding: 1.5rem;
      float: right;
      display: flex;
      justify-content: flex-end;
    }
    .no-video-message {
      padding: 1rem;
      font-family: 'Roboto', sans-serif;
    }
    .no-timestamps-msg {
      padding: 1rem;
      align-items: center;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class TimelineComponent implements TimestampChangeObserver {
  public readonly TOGGLE_BUTTON_CLASS: string = "button-toggle-expansion";
  public readonly MAX_SELECTED_TRACES = 3;

  @Input() set activeTrace(trace: TraceType|undefined) {
    if (!trace) {
      return;
    }

    this.wrappedActiveTrace = trace;

    if (!this.selectedTraces.includes(trace)) {
      this.selectedTraces.push(trace);
    }

    if (this.selectedTraces.length > this.MAX_SELECTED_TRACES) {
      // Maxed capacity so remove oldest selected trace
      this.selectedTraces = this.selectedTraces.slice(1, 1 + this.MAX_SELECTED_TRACES);
    }

    this.selectedTracesFormControl.setValue(this.selectedTraces);
  }
  public wrappedActiveTrace: TraceType|undefined = undefined;

  @Input() availableTraces: TraceType[] = [];
  @Input() set videoData(value: Blob|undefined) {
    if (value !== undefined) {
      this.videoUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(value));
    } else {
      this.videoUrl = undefined;
    }
  }

  @Output() onCollapsedTimelineSizeChanged = new EventEmitter<number>();

  @ViewChild("miniTimeline") private miniTimelineComponent!: MiniTimelineComponent;
  @ViewChild("collapsedTimeline") private collapsedTimelineRef!: ElementRef;

  selectedTraces: TraceType[] = [];
  selectedTracesFormControl = new FormControl();

  selectedTimeFormControl = new FormControl("", Validators.compose([
    Validators.required,
    Validators.pattern(TimeUtils.HUMAN_TIMESTAMP_REGEX)]));
  selectedNsFormControl = new FormControl(BigInt(0), Validators.compose([
    Validators.required,
    Validators.pattern(TimeUtils.NS_TIMESTAMP_REGEX)]));
  timestampForm = new FormGroup({
    selectedTime: this.selectedTimeFormControl,
    selectedNs: this.selectedNsFormControl,
  });

  videoUrl: SafeUrl|undefined;

  private expanded = false;

  TRACE_INFO = TRACE_INFO;

  get hasVideo() {
    return this.timelineCoordinator.getTimelines().get(TraceType.SCREEN_RECORDING) !== undefined;
  }

  get videoCurrentTime() {
    return this.timelineCoordinator.timestampAsElapsedScreenrecordingSeconds(this.currentTimestamp);
  }

  private seekTimestamp: Timestamp|undefined;

  hasTimestamps(): boolean {
    return this.timelineCoordinator.getAllTimestamps().length > 0;
  }

  get currentTimestamp(): Timestamp {
    if (this.seekTimestamp !== undefined) {
      return this.seekTimestamp;
    }

    const timestamp = this.timelineCoordinator.currentTimestamp;
    if (timestamp === undefined) {
      throw Error("A timestamp should have been set by the time the timeline is loaded");
    }

    return timestamp;
  }

  constructor(
    @Inject(TimelineCoordinator) public timelineCoordinator: TimelineCoordinator,
    @Inject(DomSanitizer) private sanitizer: DomSanitizer,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef) {
    this.timelineCoordinator.registerObserver(this);
  }

  ngOnDestroy() {
    this.timelineCoordinator.unregisterObserver(this);
  }

  ngAfterViewInit() {
    const height = this.collapsedTimelineRef.nativeElement.offsetHeight;
    this.onCollapsedTimelineSizeChanged.emit(height);
  }

  onCurrentTimestampChanged(timestamp: Timestamp|undefined): void {
    if (!timestamp) {
      return;
    }
    this.updateTimeInputValuesToCurrentTimestamp();
  }

  toggleExpand() {
    this.expanded = !this.expanded;
    this.changeDetectorRef.detectChanges();
  }

  updateCurrentTimestamp(timestamp: Timestamp) {
    this.timelineCoordinator.updateCurrentTimestamp(timestamp);
  }

  updateSeekTimestamp(timestamp: Timestamp|undefined) {
    this.seekTimestamp = timestamp;
    this.updateTimeInputValuesToCurrentTimestamp();
  }

  private updateTimeInputValuesToCurrentTimestamp() {
    this.selectedTimeFormControl.setValue(TimeUtils.nanosecondsToHuman(this.currentTimestamp.getValueNs(), false));
    this.selectedNsFormControl.setValue(this.currentTimestamp.getValueNs());
  }

  isOptionDisabled(trace: TraceType) {
    if (this.wrappedActiveTrace === trace) {
      return true;
    }

    // Reached limit of options and is not a selected element
    if ((this.selectedTracesFormControl.value?.length ?? 0) >= this.MAX_SELECTED_TRACES
      && this.selectedTracesFormControl.value?.find((el: TraceType) => el === trace) === undefined) {
      return true;
    }

    return false;
  }

  onTraceSelectionClosed() {
    this.selectedTracesFormControl.setValue(this.selectedTraces);
  }

  applyNewTraceSelection() {
    this.selectedTraces = this.selectedTracesFormControl.value;
  }

  @HostListener("document:keydown", ["$event"])
  handleKeyboardEvent(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowLeft": {
        this.moveToPreviousEntry();
        break;
      }
      case "ArrowRight": {
        this.moveToNextEntry();
        break;
      }
    }
  }

  hasPrevEntry(): boolean {
    if (!this.wrappedActiveTrace ||
      (this.timelineCoordinator.getTimelines().get(this.wrappedActiveTrace)?.length ?? 0) === 0) {
      return false;
    }
    return this.timelineCoordinator.getPreviousTimestampFor(this.wrappedActiveTrace) !== undefined;
  }

  hasNextEntry(): boolean {
    if (!this.wrappedActiveTrace ||
      (this.timelineCoordinator.getTimelines().get(this.wrappedActiveTrace)?.length ?? 0) === 0) {
      return false;
    }
    return this.timelineCoordinator.getNextTimestampFor(this.wrappedActiveTrace) !== undefined;
  }

  moveToPreviousEntry() {
    if (!this.wrappedActiveTrace) {
      return;
    }
    this.timelineCoordinator.moveToPreviousEntryFor(this.wrappedActiveTrace);
  }

  moveToNextEntry() {
    if (!this.wrappedActiveTrace) {
      return;
    }
    this.timelineCoordinator.moveToNextEntryFor(this.wrappedActiveTrace);
  }

  inputTimeChanged(event: Event) {
    console.error("Input time changed to", event);
    if (event.type !== "change") {
      return;
    }

    const target = event.target as HTMLInputElement;

    if (TimeUtils.NS_TIMESTAMP_REGEX.test(target.value)) {
      const timestamp = new Timestamp(this.timelineCoordinator.getTimestampType()!, BigInt(target.value));
      this.timelineCoordinator.updateCurrentTimestamp(timestamp);
    } else if (TimeUtils.HUMAN_TIMESTAMP_REGEX.test(target.value)) {
      const timestamp = new Timestamp(this.timelineCoordinator.getTimestampType()!,
        TimeUtils.humanToNanoseconds(target.value));
      this.timelineCoordinator.updateCurrentTimestamp(timestamp);
    } else {
      console.warn(`Invalid timestamp input provided "${target.value}" and can't be processed.`);
      return;
    }

    this.updateTimeInputValuesToCurrentTimestamp();
  }
}
