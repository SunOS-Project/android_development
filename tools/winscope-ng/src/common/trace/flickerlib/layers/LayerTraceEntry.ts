/*
 * Copyright 2021, The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Display, LayerTraceEntry, LayerTraceEntryBuilder, toRect, toSize, toTransform } from "../common"
import Layer from './Layer'

LayerTraceEntry.fromProto = function (protos: any[], displayProtos: any[],
        timestamp: number, hwcBlob: string, where: string = ''): LayerTraceEntry {
    const layers = protos.map(it => Layer.fromProto(it));
    const displays = (displayProtos || []).map(it => newDisplay(it));
    const builder = new LayerTraceEntryBuilder(timestamp, layers, displays, hwcBlob, where);
    const entry: LayerTraceEntry = builder.build();

    addAttributes(entry, protos);
    return entry;
}

function addAttributes(entry: LayerTraceEntry, protos: any) {
    entry.kind = "entry"
    // There no JVM/JS translation for Longs yet
    entry.timestampMs = entry.timestamp.toString()
    entry.rects = entry.visibleLayers
        .sort((a: any, b: any) => (b.absoluteZ > a.absoluteZ) ? 1 : (a.absoluteZ == b.absoluteZ) ? 0 : -1)
        .map((it: any) => it.rect);

    // Avoid parsing the entry root because it is an array of layers
    // containing all trace information, this slows down the property tree.
    // Instead parse only key properties for debugging
    const entryIds: any = {}
    protos.forEach((it: any) =>
        entryIds[<keyof typeof entryIds>it.id] = `\nparent=${it.parent}\ntype=${it.type}\nname=${it.name}`
    );
    entry.proto = entryIds;
    entry.shortName = entry.name;
    entry.isVisible = true;
}

function newDisplay(proto: any): Display {
    return new Display(
        proto.id,
        proto.name,
        proto.layerStack,
        toSize(proto.size),
        toRect(proto.layerStackSpaceRect),
        toTransform(proto.transform),
        proto.isVirtual
    )
}

export {LayerTraceEntry};
