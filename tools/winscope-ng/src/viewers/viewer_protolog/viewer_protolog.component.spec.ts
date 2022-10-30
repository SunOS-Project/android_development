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
import {ScrollingModule} from "@angular/cdk/scrolling";
import {ComponentFixture, ComponentFixtureAutoDetect, TestBed} from "@angular/core/testing";
import {ViewerProtologComponent} from "./viewer_protolog.component";

import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from "@angular/core";

describe("ViewerProtologComponent", () => {
  let fixture: ComponentFixture<ViewerProtologComponent>;
  let component: ViewerProtologComponent;
  let htmlElement: HTMLElement;

  beforeAll(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: ComponentFixtureAutoDetect, useValue: true }
      ],
      imports: [
        ScrollingModule
      ],
      declarations: [
        ViewerProtologComponent,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewerProtologComponent);
    component = fixture.componentInstance;
    htmlElement = fixture.nativeElement;
  });

  it("can be created", () => {
    expect(component).toBeTruthy();
  });

  it("creates message filters", () => {
    expect(htmlElement.querySelector(".filters .log-level")).toBeTruthy();
    expect(htmlElement.querySelector(".filters .tag")).toBeTruthy();
    expect(htmlElement.querySelector(".filters .source-file")).toBeTruthy();
    expect(htmlElement.querySelector(".filters .text")).toBeTruthy();
  });

  it("renders log messages", () => {
    expect(htmlElement.querySelector(".scroll-messages")).toBeTruthy();
  });
});
