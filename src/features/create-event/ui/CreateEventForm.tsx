"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { useCreateEvent } from "@/entities/event/hooks/useEvents";
import { majorToCents } from "@/shared/lib/money";
import { Button, Input } from "@/shared/ui";
import { createEventSchema, type CreateEventValues } from "../model/schema";
import styles from "./CreateEventForm.module.scss";

export function CreateEventForm() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateEvent();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEventValues>({
    resolver: yupResolver(createEventSchema),
    mode: "onBlur",
    defaultValues: { description: "", priceMajor: 0, totalTickets: 50 },
  });

  const onSubmit = async (values: CreateEventValues) => {
    const event = await mutateAsync({
      title: values.title,
      description: values.description || undefined,
      venue: values.venue,
      startsAt: new Date(values.startsAtLocal).toISOString(),
      priceCents: majorToCents(values.priceMajor),
      totalTickets: values.totalTickets,
    });

    router.push(`/events/${event.id}`);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input
        label="Title"
        required
        placeholder="Karachi Jazz Night"
        error={errors.title?.message}
        {...register("title")}
      />

      <Input
        label="Venue"
        required
        placeholder="Arts Council Auditorium"
        error={errors.venue?.message}
        {...register("venue")}
      />

      <Input
        label="Description"
        placeholder="Optional"
        error={errors.description?.message}
        {...register("description")}
      />

      <Input
        label="Starts at"
        type="datetime-local"
        required
        hint="Your local time. Stored as a UTC instant, shown to each attendee in their own timezone."
        error={errors.startsAtLocal?.message}
        {...register("startsAtLocal")}
      />

      <div className={styles.row}>
        <Input
          label="Price"
          type="number"
          step="0.01"
          min="0"
          required
          hint="In dollars, e.g. 19.99. Stored as integer cents."
          error={errors.priceMajor?.message}
          {...register("priceMajor")}
        />

        <Input
          label="Capacity"
          type="number"
          step="1"
          min="1"
          required
          hint="Total tickets available."
          error={errors.totalTickets?.message}
          {...register("totalTickets")}
        />
      </div>

      <Button type="submit" isLoading={isPending} fullWidth>
        {isPending ? "Creating…" : "Create event"}
      </Button>

    </form>
  );
}
