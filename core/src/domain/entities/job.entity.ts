import { v4 as uuid } from "uuid";

export type JobStatus =
  | "pending"
  | "parsing"
  | "correcting"
  | "fact_checking"
  | "generating"
  | "done"
  | "error";

export type InputFormat = "docx" | "doc" | "txt" | "md" | "pdf";

export interface FactChange {
  original: string;
  corrected: string;
  context: string;
  source?: string;
}

export interface JobProps {
  id: string;
  userId: number;
  status: JobStatus;
  inputType: "text" | "file";
  inputFormat?: InputFormat;
  originalText: string;
  correctedText?: string;
  factChanges?: FactChange[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class Job {
  private constructor(private props: JobProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): number {
    return this.props.userId;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get inputType(): "text" | "file" {
    return this.props.inputType;
  }

  get inputFormat(): InputFormat | undefined {
    return this.props.inputFormat;
  }

  get originalText(): string {
    return this.props.originalText;
  }

  get correctedText(): string | undefined {
    return this.props.correctedText;
  }

  get factChanges(): FactChange[] | undefined {
    return this.props.factChanges;
  }

  get error(): string | undefined {
    return this.props.error;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  static createTextJob(userId: number, text: string): Job {
    return new Job({
      id: uuid(),
      userId,
      status: "pending",
      inputType: "text",
      originalText: text,
      createdAt: new Date(),
    });
  }

  static createFileJob(userId: number, format: InputFormat): Job {
    return new Job({
      id: uuid(),
      userId,
      status: "pending",
      inputType: "file",
      inputFormat: format,
      originalText: "",
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: JobProps): Job {
    return new Job(props);
  }

  updateStatus(status: JobStatus): Job {
    return new Job({
      ...this.props,
      status,
    });
  }

  setOriginalText(text: string): Job {
    return new Job({
      ...this.props,
      originalText: text,
      status: "correcting",
    });
  }

  setCorrectedText(text: string): Job {
    return new Job({
      ...this.props,
      correctedText: text,
      status: "fact_checking",
    });
  }

  setFactChanges(changes: FactChange[]): Job {
    return new Job({
      ...this.props,
      factChanges: changes,
      status: "generating",
    });
  }

  complete(): Job {
    return new Job({
      ...this.props,
      status: "done",
      completedAt: new Date(),
    });
  }

  fail(error: string): Job {
    return new Job({
      ...this.props,
      status: "error",
      error,
      completedAt: new Date(),
    });
  }

  toJSON(): JobProps {
    return { ...this.props };
  }
}
