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
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  resolve: {
    extensions: [".ts", ".js", ".css"],
    modules: [
      "node_modules",
      "src",
      "kotlin_build",
      path.resolve(__dirname, "../../.."),
    ]
  },

  resolveLoader: {
    modules: ["node_modules", path.resolve(__dirname, "loaders")],
  },

  module: {
    rules:[
      {
        test: /\.ts$/,
        use: ["ts-loader", "angular2-template-loader"]
      },
      {
        test: /\.html$/,
        use: ["html-loader"]
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.s[ac]ss$/i,
        use: ["style-loader", "css-loader", "sass-loader"]
      },
      {
        test: /\.proto$/,
        loader: "proto-loader",
        options: {
          paths: [
            path.resolve(__dirname, "../../.."),
            path.resolve(__dirname, "../../../external/protobuf/src"),
          ]
        }
      },
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "src/index.html",
      inject: "body",
      inlineSource: ".(css|js)$",
    })
  ],

  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_fnames: true,
        },
      }),
    ],
  },
};
