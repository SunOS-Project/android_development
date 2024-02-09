/*
 * Copyright 2024 The Android Open Source Project
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

package com.android.sharetest

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Bundle
import android.service.chooser.ChooserAction
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.TextUtils
import android.text.style.BackgroundColorSpan
import android.text.style.BulletSpan
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.text.style.UnderlineSpan
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Spinner
import android.widget.Toast
import androidx.annotation.RequiresApi

private const val BROADCAST_ACTION = "broadcast-action"
private const val IMAGE_COUNT = 8
private const val TYPE_IMAGE = "Image"
private const val TYPE_VIDEO = "Video"
private const val TYPE_PDF = "PDF Doc"
private const val TYPE_IMG_VIDEO = "Image / Video Mix"
private const val TYPE_IMG_PDF = "Image / PDF Mix"
private const val TYPE_VIDEO_PDF = "Video / PDF Mix"
private const val TYPE_ALL = "All Type Mix"

@RequiresApi(34)
class ShareTestActivity : Activity() {
    private lateinit var customActionReceiver: BroadcastReceiver
    private lateinit var mediaSelection: RadioGroup
    private lateinit var textSelection: RadioGroup
    private lateinit var mediaTypeSelection: Spinner
    private lateinit var richText: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        customActionReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                Toast.makeText(this@ShareTestActivity, "Custom action invoked", Toast.LENGTH_LONG)
                    .show()
            }
        }

        registerReceiver(
            customActionReceiver,
            IntentFilter(BROADCAST_ACTION),
            Context.RECEIVER_EXPORTED
        )

        richText = requireViewById(R.id.use_rich_text)
        mediaTypeSelection = requireViewById(R.id.media_type_selection)
        mediaSelection = requireViewById<RadioGroup>(R.id.media_selection).apply {
            setOnCheckedChangeListener { _, id -> updateMediaTypesList(id) }
            check(R.id.no_media)
        }

        textSelection = requireViewById<RadioGroup>(R.id.text_selection).apply {
            check(R.id.short_text)
        }
        requireViewById<RadioGroup>(R.id.action_selection).check(R.id.no_actions)

        requireViewById<Button>(R.id.share).setOnClickListener(this::share)

        requireViewById<RadioButton>(R.id.no_media).setOnClickListener {
            if (textSelection.checkedRadioButtonId == R.id.no_text) {
                textSelection.check(R.id.short_text)
            }
        }

        requireViewById<RadioGroup>(R.id.image_latency).setOnCheckedChangeListener { _, checkedId ->
            ImageContentProvider.openLatency = when (checkedId) {
                R.id.image_latency_50 -> 50
                R.id.image_latency_200 -> 200
                R.id.image_latency_800 -> 800
                else -> 0
            }
        }
        requireViewById<RadioGroup>(R.id.image_latency).check(R.id.image_latency_none)

        requireViewById<RadioGroup>(R.id.image_get_type_latency).setOnCheckedChangeListener { _, checkedId ->
            ImageContentProvider.getTypeLatency = when (checkedId) {
                R.id.image_get_type_latency_50 -> 50
                R.id.image_get_type_latency_200 -> 200
                R.id.image_get_type_latency_800 -> 800
                else -> 0
            }
        }
        requireViewById<RadioGroup>(R.id.image_get_type_latency).check(R.id.image_get_type_latency_none)

        requireViewById<RadioGroup>(R.id.image_load_failure_rate).setOnCheckedChangeListener { _, checkedId ->
            ImageContentProvider.openFailureRate = when (checkedId) {
                R.id.image_load_failure_rate_50 -> .5f
                R.id.image_load_failure_rate_100 -> 1f
                else -> 0f
            }
        }
        requireViewById<RadioGroup>(R.id.image_load_failure_rate).check(R.id.image_load_failure_rate_none)
    }

    private fun updateMediaTypesList(id: Int) {
        when (id) {
            R.id.no_media -> removeMediaTypeOptions()
            R.id.one_image -> setSingleMediaTypeOptions()
            R.id.many_images -> setAllMediaTypeOptions()
        }
    }

    private fun removeMediaTypeOptions() {
        mediaTypeSelection.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_item, emptyArray<String>()
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        mediaTypeSelection.isEnabled = false
    }

    private fun setSingleMediaTypeOptions() {
        mediaTypeSelection.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            arrayOf(TYPE_IMAGE, TYPE_VIDEO, TYPE_PDF)
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        mediaTypeSelection.isEnabled = true
    }

    private fun setAllMediaTypeOptions() {
        mediaTypeSelection.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            arrayOf(
                TYPE_IMAGE,
                TYPE_VIDEO,
                TYPE_PDF,
                TYPE_IMG_VIDEO,
                TYPE_IMG_PDF,
                TYPE_VIDEO_PDF,
                TYPE_ALL
            )
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        mediaTypeSelection.isEnabled = true
    }

    private fun share(view: View) {
        val share = Intent(Intent.ACTION_SEND)
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        val mimeTypes = getSelectedContentTypes()

        val imageUris = ArrayList(
            (1..IMAGE_COUNT).map{ idx ->
                makeItemUri(idx, mimeTypes[idx % mimeTypes.size])
            }.shuffled())

        when (mediaSelection.checkedRadioButtonId) {
            R.id.one_image -> share.apply {
                putExtra(Intent.EXTRA_STREAM, imageUris[0])
                clipData = ClipData("", arrayOf("image/jpg"), ClipData.Item(imageUris[0]))
                type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
            }
            R.id.many_images -> share.apply {
                action = Intent.ACTION_SEND_MULTIPLE
                clipData = ClipData("", arrayOf("image/jpg"), ClipData.Item(imageUris[0])).apply {
                    for (i in 1 until IMAGE_COUNT) {
                        addItem(ClipData.Item(imageUris[i]))
                    }
                }
                type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
                putParcelableArrayListExtra(
                    Intent.EXTRA_STREAM,
                    imageUris
                )
            }
        }

        val url = "https://developer.android.com/training/sharing/send#adding-rich-content-previews"

        when (textSelection.checkedRadioButtonId) {
            R.id.short_text -> setIntentText(share, createShortText())
            R.id.long_text -> setIntentText(share, createLongText())
            R.id.url_text -> setIntentText(share, url)
        }

        if (requireViewById<CheckBox>(R.id.include_title).isChecked) {
            share.putExtra(Intent.EXTRA_TITLE, createTextTitle())
        }

        if (requireViewById<CheckBox>(R.id.include_icon).isChecked) {
            share.clipData = ClipData(
                "", arrayOf("image/png"), ClipData.Item(ImageContentProvider.ICON_URI))
            share.data = ImageContentProvider.ICON_URI
        }

        val chosenComponentPendingIntent = PendingIntent.getBroadcast(
            this, 0,
            Intent(this, ChosenComponentBroadcastReceiver::class.java),
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val chooserIntent =
            Intent.createChooser(share, null, chosenComponentPendingIntent.intentSender)

        if (requireViewById<CheckBox>(R.id.include_modify_share).isChecked) {
            val pendingIntent = PendingIntent.getBroadcast(
                this,
                1,
                Intent(BROADCAST_ACTION),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_CANCEL_CURRENT
            )
            val modifyShareAction = ChooserAction.Builder(
                Icon.createWithResource(this, R.drawable.testicon),
                "Modify Share",
                pendingIntent
            ).build()

            chooserIntent.putExtra(Intent.EXTRA_CHOOSER_MODIFY_SHARE_ACTION, modifyShareAction)
        }

        when (requireViewById<RadioGroup>(R.id.action_selection).checkedRadioButtonId) {
            R.id.one_action -> chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_CUSTOM_ACTIONS, getCustomActions(1)
            )
            R.id.five_actions -> chooserIntent.putExtra(
                Intent.EXTRA_CHOOSER_CUSTOM_ACTIONS, getCustomActions(5)
            )
        }

        startActivity(chooserIntent)
    }

    private fun getSelectedContentTypes(): Array<String> =
        mediaTypeSelection.selectedItem?.let { types ->
            when (types) {
                TYPE_VIDEO -> arrayOf("video/mp4")
                TYPE_PDF -> arrayOf("application/pdf")
                TYPE_IMG_VIDEO -> arrayOf("image/jpeg", "video/mp4")
                TYPE_IMG_PDF -> arrayOf("image/jpeg", "application/pdf")
                TYPE_VIDEO_PDF -> arrayOf("video/mp4", "application/pdf")
                TYPE_ALL -> arrayOf("image/jpeg", "video/mp4", "application/pdf")
                else -> null
            }
        } ?: arrayOf("image/jpeg")

    private fun makeItemUri(idx: Int, mimeType: String): Uri =
        Uri.parse("${ImageContentProvider.URI_PREFIX}img$idx.jpg")
            .buildUpon()
            .appendQueryParameter(ImageContentProvider.PARAM_TYPE, mimeType)
            .build()

    private fun setIntentText(intent: Intent, text: CharSequence) {
        if (TextUtils.isEmpty(intent.type)) {
            intent.type = "text/plain"
        }
        intent.putExtra(Intent.EXTRA_TEXT, text)
    }

    private fun createShortText(): CharSequence =
        SpannableStringBuilder()
            .append("This", StyleSpan(Typeface.BOLD), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(" is ", StyleSpan(Typeface.ITALIC), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append("a bit of ")
            .append("text", BackgroundColorSpan(Color.YELLOW), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(" to ")
            .append("share", ForegroundColorSpan(Color.GREEN), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(".")
            .let {
                if (richText.isChecked) it else it.toString()
            }

    private fun createLongText(): CharSequence =
        SpannableStringBuilder("Here is a lot more text to share:")
            .apply {
                val colors =
                    arrayOf(Color.RED,
                        Color.GREEN,
                        Color.BLUE,
                        Color.CYAN,
                        Color.MAGENTA,
                        Color.YELLOW,
                        Color.BLACK,
                        Color.DKGRAY,
                        Color.GRAY)
                for (color in colors) {
                    append("\n")
                    append(createShortText(), BulletSpan(40, color, 20), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
                }
            }
            .let {
                if (richText.isChecked) it else it.toString()
            }

    private fun createTextTitle(): CharSequence =
        SpannableStringBuilder()
            .append("Here's", UnderlineSpan(), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append(" the ", StyleSpan(Typeface.ITALIC), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append("Title", ForegroundColorSpan(Color.RED), Spannable.SPAN_INCLUSIVE_EXCLUSIVE)
            .append("!")
            .let {
                if (richText.isChecked) it else it.toString()
            }

    private fun getCustomActions(count: Int): Array<ChooserAction?> {
        val actions = arrayOfNulls<ChooserAction>(count)

        for (i in 0 until count) {
            val customAction = PendingIntent.getBroadcast(
                this,
                i,
                Intent(BROADCAST_ACTION),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_CANCEL_CURRENT
            )
            actions[i] = ChooserAction.Builder(
                Icon.createWithResource(this, R.drawable.testicon),
                "Action ${i + 1}",
                customAction
            ).build()
        }

        return actions
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(customActionReceiver)
    }
}


