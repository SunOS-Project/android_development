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
import { Component, Input, Output, EventEmitter, Inject, NgZone } from "@angular/core";
import { TraceCoordinator } from "app/trace_coordinator";
import { TRACE_INFO } from "app/trace_info";
import { LoadedTrace } from "app/loaded_trace";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ParserErrorSnackBarComponent } from "./parser_error_snack_bar_component";
import { ParserError } from "parsers/parser_factory";

@Component({
  selector: "upload-traces",
  template: `
      <mat-card-title id="title">Upload Traces</mat-card-title>
      <mat-card-content>
        <div
          class="drop-box"
          ref="drop-box"
          (dragleave)="onFileDragOut($event)"
          (dragover)="onFileDragIn($event)"
          (drop)="onHandleFileDrop($event)"
          (click)="fileDropRef.click()"
        >
          <input
            hidden
            class="input-files"
            id="fileDropRef"
            type="file"
            (change)="onInputFile($event)"
            #fileDropRef
            multiple
          />
          <mat-list
            class="uploaded-files"
            *ngIf="this.loadedTraces.length > 0"
          >
            <mat-list-item *ngFor="let trace of loadedTraces" class="listed-file">
              <span class="listed-file">
                <mat-icon class= "listed-file-item">{{TRACE_INFO[trace.type].icon}}</mat-icon>
                <span class="listed-file-item">{{trace.name}} ({{TRACE_INFO[trace.type].name}})</span>
                <button
                  (click)="onRemoveTrace($event, trace)"
                  class="icon-button close-btn listed-file-item"
                ><mat-icon>close</mat-icon>
                </button>
              </span>
            </mat-list-item>
          </mat-list>
          <span *ngIf="this.loadedTraces.length === 0" class="drop-info">Drag your .winscope file(s) or click to upload</span>
        </div>

        <div class="load-traces-btns" *ngIf="this.loadedTraces.length > 0">
          <button mat-raised-button class="load-btn" (click)="onLoadData()">View traces</button>
          <button mat-stroked-button for="fileDropRef" (click)="fileDropRef.click()">Upload another file</button>
          <button mat-stroked-button (click)="onClearData()">Clear all</button>
        </div>
      </mat-card-content>
  `,
  styles: [
    `
      .drop-box {
        outline: 2px dashed var(--default-border);
        outline-offset: -10px;
        background: white;
        padding: 10px 10px 10px 10px;
        height: 400px;
        position: relative;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        overflow: auto;
        text-align: center;
        align-items: center;
        justify-items: center;
        vertical-align: middle;
      }
      .drop-info {
        font-weight: normal;
        pointer-events: none;
        margin: auto;
      }
      #inputfile {
        margin: auto;
      }
      .uploaded-files {
        text-align: left;
        height: 400px;
        overflow: auto;
        width: 100%;
      }
      .listed-file {
        width: 100%;
        position: relative;
        display: inline-block;
        height: 100%;
        width: 100%;
      }
      .listed-file-item {
        position: relative;
        display: inline-block;
        vertical-align: middle;
        align-items: center;
      }
      .close-btn {
        float: right;
      }
    `
  ]
})
export class UploadTracesComponent {
  loadedTraces: LoadedTrace[] = [];
  TRACE_INFO = TRACE_INFO;
  dataLoaded = false;

  @Input() traceCoordinator!: TraceCoordinator;
  @Output() dataLoadedChange = new EventEmitter<boolean>();

  constructor(
    @Inject(NgZone) private ngZone: NgZone,
    @Inject(MatSnackBar) private snackBar: MatSnackBar
  ) {}

  public async onInputFile(event: Event) {
    const files = this.getInputFiles(event);
    await this.processFiles(files);
  }

  public async processFiles(files: File[]) {
    const unzippedFiles = await this.traceCoordinator.getUnzippedFiles(files);
    const parserErrors = await this.traceCoordinator.addTraces(unzippedFiles);
    if (parserErrors.length > 0) {
      this.openTempSnackBar(parserErrors);
    }
    this.ngZone.run(() => {
      this.loadedTraces = this.traceCoordinator.getLoadedTraces();
    });
  }

  public onLoadData() {
    this.dataLoaded = true;
    this.dataLoadedChange.emit(this.dataLoaded);
  }

  public onClearData() {
    this.traceCoordinator.clearData();
    this.dataLoaded = false;
    this.loadedTraces = [];
    this.dataLoadedChange.emit(this.dataLoaded);
  }

  public onFileDragIn(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  public onFileDragOut(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  public async onHandleFileDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = e.dataTransfer?.files;
    if(!droppedFiles) return;
    await this.processFiles(Array.from(droppedFiles));
  }

  public onRemoveTrace(event: MouseEvent, trace: LoadedTrace) {
    event.preventDefault();
    event.stopPropagation();
    this.traceCoordinator.removeTrace(trace.type);
    this.loadedTraces = this.loadedTraces.filter(loaded => loaded.type !== trace.type);
  }

  private openTempSnackBar(parserErrors: ParserError[]) {
    this.snackBar.openFromComponent(ParserErrorSnackBarComponent, {
      data: parserErrors,
      duration: 7500,
    });
  }

  private getInputFiles(event: Event): File[] {
    const files: FileList | null = (event?.target as HTMLInputElement)?.files;
    if (!files || !files[0]) {
      return [];
    }
    return Array.from(files);
  }
}
