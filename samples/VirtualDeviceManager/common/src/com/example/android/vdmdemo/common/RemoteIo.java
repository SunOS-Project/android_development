/*
 * Copyright (C) 2023 The Android Open Source Project
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

package com.example.android.vdmdemo.common;

import android.util.ArrayMap;
import android.util.Log;
import com.example.android.vdmdemo.common.RemoteEventProto.RemoteEvent;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import javax.inject.Inject;
import javax.inject.Singleton;

/** Simple message exchange framework between the client and the host. */
@Singleton
public class RemoteIo {
  public static final String TAG = "VdmRemoteIo";

  interface StreamClosedCallback {
    void onStreamClosed();
  }

  private OutputStream outputStream = null;
  private StreamClosedCallback outputStreamClosedCallback = null;

  private final Map<Object, MessageConsumer> messageConsumers =
      Collections.synchronizedMap(new ArrayMap<>());

  @Inject
  RemoteIo() {}

  @SuppressWarnings("ThreadPriorityCheck")
  void initialize(InputStream inputStream, StreamClosedCallback inputStreamClosedCallback) {
    Thread t =
        new Thread(
            () -> {
              try {
                while (true) {
                  RemoteEvent event = RemoteEvent.parseDelimitedFrom(inputStream);
                  if (event == null) {
                    break;
                  }
                  messageConsumers
                      .values()
                      .forEach(
                          consumer -> {
                            if (consumer != null) {
                              consumer.accept(event);
                            }
                          });
                }
              } catch (IOException e) {
                Log.e(TAG, "Failed to obtain event: " + e);
              }
              inputStreamClosedCallback.onStreamClosed();
            });
    t.setPriority(Thread.MAX_PRIORITY);
    t.start();
  }

  synchronized void initialize(
      OutputStream outputStream, StreamClosedCallback outputStreamClosedCallback) {
    this.outputStream = outputStream;
    this.outputStreamClosedCallback = outputStreamClosedCallback;
  }

  public void addMessageConsumer(Consumer<RemoteEvent> consumer) {
    messageConsumers.put(consumer, new MessageConsumer(consumer));
  }

  public void removeMessageConsumer(Consumer<RemoteEvent> consumer) {
    if (messageConsumers.remove(consumer) == null) {
      Log.w(TAG, "Failed to remove message consumer.");
    }
  }

  public synchronized void sendMessage(RemoteEvent event) {
    if (outputStream != null) {
      try {
        event.writeDelimitedTo(outputStream);
        outputStream.flush();
      } catch (IOException e) {
        outputStream = null;
        outputStreamClosedCallback.onStreamClosed();
      }
    } else {
      Log.e(TAG, "Failed to send event, RemoteIO not initialized.");
    }
  }

  private static class MessageConsumer {
    private final Executor executor;
    private final Consumer<RemoteEvent> consumer;

    public MessageConsumer(Consumer<RemoteEvent> consumer) {
      executor = Executors.newSingleThreadExecutor();
      this.consumer = consumer;
    }

    public void accept(RemoteEvent event) {
      executor.execute(() -> consumer.accept(event));
    }
  }
}
