import DemoQuestion from "@/shared/components/common/demo-question";

export function DemoQuestionSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-4">Preview Our Interactive Learning</h2>
          <p className="text-xl text-muted-foreground">
            Experience our interactive learning format with this sample question
          </p>
        </div>
        <DemoQuestion />
      </div>
    </section>
  );
}
