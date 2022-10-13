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
import { TraceType } from "common/trace/trace_type";
import { Viewer } from "./viewer";
import { ViewerWindowManager } from "./viewer_window_manager/viewer_window_manager";
import { ViewerSurfaceFlinger } from "./viewer_surface_flinger/viewer_surface_flinger";
import { ViewerInputMethodClients } from "./viewer_input_method_clients/viewer_input_method_clients";
import { ViewerInputMethodService } from "./viewer_input_method_service/viewer_input_method_service";
import { ViewerInputMethodManagerService } from "./viewer_input_method_manager_service/viewer_input_method_manager_service";

class ViewerFactory {
  static readonly VIEWERS = [
    ViewerWindowManager,
    ViewerSurfaceFlinger,
    ViewerInputMethodClients,
    ViewerInputMethodService,
    ViewerInputMethodManagerService,
  ];

  public createViewers(activeTraceTypes: Set<TraceType>): Viewer[] {
    const viewers: Viewer[] = [];

    for (const Viewer of ViewerFactory.VIEWERS) {
      const areViewerDepsSatisfied = Viewer.DEPENDENCIES.every((traceType: TraceType) =>
        activeTraceTypes.has(traceType)
      );

      if (areViewerDepsSatisfied) {
        viewers.push(new Viewer());
      }
    }

    return viewers;
  }
}

export { ViewerFactory };
