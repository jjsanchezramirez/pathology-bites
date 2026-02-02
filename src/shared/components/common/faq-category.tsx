// src/shared/components/common/faq-category.tsx
import { Card } from "@/shared/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { FAQCategory as FAQCategoryType } from "@/shared/config/faq-data";

interface FAQCategoryProps {
  category: FAQCategoryType;
}

export function FAQCategory({ category }: FAQCategoryProps) {
  return (
    <Card className="p-8 shadow-lg mb-8">
      <h2 className="text-2xl font-bold mb-6">{category.title}</h2>
      <Accordion type="single" collapsible className="w-full">
        {category.items.map((item) => (
          <AccordionItem key={item.value} value={item.value}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}
