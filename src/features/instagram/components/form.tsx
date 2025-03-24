"use client";

import React from "react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";

import { downloadFile } from "@/lib/utils";
import { getHttpErrorMessage } from "@/lib/http";

import { useVideoInfo } from "@/services/api/queries";

const formSchema = z.object({
  postUrls: z.string().transform((str) => {
    const urls = str.split('\n').map(url => url.trim()).filter(url => url.length > 0);
    if (urls.length === 0) {
      throw new Error("Please provide at least one Instagram link");
    }
    if (urls.length > 10) {
      throw new Error("Maximum 10 links allowed");
    }
    return urls;
  }).refine((urls) => {
    return urls.every(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  }, {
    message: "All links must be valid URLs",
  }),
});

export function InstagramVideoForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      postUrls: "",
    },
  });

  const { error, isPending, mutateAsync: getVideoInfo } = useVideoInfo();
  const [downloadProgress, setDownloadProgress] = React.useState<number>(0);

  const httpError = getHttpErrorMessage(error);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { postUrls } = values;
    try {
      setDownloadProgress(0);
      const total = postUrls.length;
      
      for (let i = 0; i < postUrls.length; i++) {
        const postUrl = postUrls[i];
        console.log("getting video info", postUrl);
        const videoInfo = await getVideoInfo({ postUrl });
        const { filename, videoUrl } = videoInfo;
        await downloadFile(videoUrl, { filename });
        setDownloadProgress(((i + 1) / total) * 100);
      }
    } catch (error: any) {
      console.log(error);
    } finally {
      setDownloadProgress(0);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-accent/20 my-4 flex w-full max-w-2xl flex-col items-center rounded-lg border px-4 pb-16 pt-8 shadow-md sm:px-8"
      >
        <div className="mb-2 h-6 w-full px-2 text-start text-red-500">
          {httpError}
        </div>
        <div className="relative mb-6 flex w-full flex-col items-center gap-4 sm:flex-row">
          <FormField
            control={form.control}
            name="postUrls"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <textarea
                    disabled={isPending}
                    placeholder="Paste your Instagram links here (one per line, max 10)..."
                    className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:pr-28"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            disabled={isPending}
            type="submit"
            className="right-1 top-1 w-full sm:absolute sm:w-fit"
          >
            {isPending ? (
              <Loader2 className="mr-2 animate-spin" />
            ) : (
              <Download className="mr-2" />
            )}
            {downloadProgress > 0 ? `Downloading ${Math.round(downloadProgress)}%` : 'Download All'}
          </Button>
        </div>
        {downloadProgress > 0 && (
          <div className="w-full max-w-md">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
        <p className="text-muted-foreground text-center text-xs mt-4">
          Videos will download directly to your device.
        </p>
      </form>
    </Form>
  );
}
