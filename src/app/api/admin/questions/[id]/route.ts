import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidateQuestions } from "@/lib/revalidation";
import { formatVersion } from "@/shared/utils/version";

// Create Supabase client with service role for admin operations
async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;

    // Auth is handled by middleware - get user ID and role from headers
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("GET - User authenticated:", userId, "Role:", userRole);

    // Use admin client for the actual operations
    const adminClient = await createAdminClient();

    // First, try a simple query to see if the question exists
    const { data: simpleQuestion, error: simpleError } = await adminClient
      .from("questions")
      .select("id, title, stem, status, created_by, updated_by, version_major, version_minor, version_patch")
      .eq("id", questionId)
      .single();

    if (simpleError || !simpleQuestion) {
      console.error("Simple question fetch error:", simpleError);
      console.error("Question ID:", questionId);
      return NextResponse.json(
        { error: "Question not found in simple query", details: simpleError?.message },
        { status: 404 }
      );
    }

    // Now try the complex query
    const { data: question, error: questionError } = await adminClient
      .from("questions")
      .select(
        `
        id,
        title,
        stem,
        difficulty,
        teaching_point,
        question_references,
        status,
        question_set_id,
        category_id,
        lesson,
        topic,
        anki_card_id,
        anki_deck_name,
        created_by,
        updated_by,
        reviewer_id,
        created_at,
        updated_at,
        version_major,
        version_minor,
        version_patch,
        question_set:question_sets(
          id,
          name,
          source_type,
          source_details,
          short_form
        ),
        category:categories(
          id,
          name
        ),
        created_by_user:users!questions_created_by_fkey(
          first_name,
          last_name
        ),
        updated_by_user:users!questions_updated_by_fkey(
          first_name,
          last_name
        ),
        question_images(
          image_id,
          question_section,
          order_index,
          image:images(
            id,
            url,
            alt_text,
            description,
            category
          )
        ),
        question_options(
          id,
          text,
          is_correct,
          explanation,
          order_index
        ),
        question_tags(
          tag:tags(
            id,
            name,
            created_at
          )
        )
      `
      )
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      console.error("Question fetch error:", questionError);
      console.error("Question ID:", questionId);
      console.error("Question data:", question);
      return NextResponse.json(
        { error: "Question not found", details: questionError?.message },
        { status: 404 }
      );
    }

    // Check permissions based on question status and user role
    const canAccess =
      userRole === "admin" ||
      (question.created_by === userId && ["admin", "creator"].includes(userRole || "")) ||
      (["reviewer", "admin"].includes(userRole || "") && question.status === "pending");

    if (!canAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions to access this question" },
        { status: 403 }
      );
    }

    // Flatten the tags structure and add user names for easier consumption
    interface QuestionTag {
      tag: {
        id: string;
        name: string;
        created_at: string;
      } | null;
    }

    const questionWithFlattenedTags = {
      ...question,
      tags:
        question.question_tags
          ?.map((qt: QuestionTag) => qt.tag)
          .filter((tag): tag is NonNullable<QuestionTag["tag"]> => tag !== null) || [],
      created_by_name: question.created_by_user
        ? `${question.created_by_user.first_name || ""} ${question.created_by_user.last_name || ""}`.trim() ||
          "Unknown"
        : "Unknown",
      updated_by_name: question.updated_by_user
        ? `${question.updated_by_user.first_name || ""} ${question.updated_by_user.last_name || ""}`.trim() ||
          "Unknown"
        : "Unknown",
    };

    return NextResponse.json({
      success: true,
      question: questionWithFlattenedTags,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/questions/:id
 *
 * Update a question with role-based permissions
 *
 * PERMISSION RULES:
 * 1. Admins: Can edit any question at any time
 * 2. Creators: Can only edit their own draft/rejected questions
 *    - CANNOT edit approved/published questions (prevents breaking changes)
 *    - CAN edit pending_review questions (before review starts)
 * 3. Reviewers: Can make patch-level edits to assigned pending_review questions
 *    - Patch edits = typos, rewording, minor corrections
 *    - Tracked via updated_by field for audit trail
 *    - Speeds up review process, reduces back-and-forth
 *
 * VERSIONING:
 * - Approved/published questions automatically create versions (admin only)
 * - Reviewer patch edits do NOT create versions (minor changes only)
 * - Tracked via updated_by and updated_at for audit trail
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    console.log("PATCH /api/admin/questions/[id] - Question ID:", questionId);
    console.log("PATCH /api/admin/questions/[id] - Params type:", typeof params);
    console.log("PATCH /api/admin/questions/[id] - Params:", params);

    const body = await request.json();
    const {
      questionData,
      changeSummary,
      answerOptions,
      questionImages,
      tagIds,
      categoryId,
      isPatchEdit,
      patchEditReason,
      updateType,
      reviewerId,
    } = body;

    console.log("PATCH /api/admin/questions/[id] - Body received:", {
      hasQuestionData: !!questionData,
      hasAnswerOptions: !!answerOptions,
      hasQuestionImages: !!questionImages,
      hasTagIds: !!tagIds,
      hasCategoryId: !!categoryId,
    });

    // Auth is handled by middleware - get user ID and role from headers
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("PATCH - User authenticated:", userId, "Role:", userRole);

    // Use admin client for the actual operations
    const adminClient = await createAdminClient();
    console.log("PATCH - Admin client created");

    // Get current question to check status and permissions
    console.log("PATCH - Fetching question with ID:", questionId);
    const { data: currentQuestion, error: questionError } = await adminClient
      .from("questions")
      .select("id, status, created_by, reviewer_id, version_major, version_minor, version_patch")
      .eq("id", questionId)
      .single();

    console.log("PATCH - Question fetch result:", {
      found: !!currentQuestion,
      error: questionError?.message,
      status: currentQuestion?.status,
    });

    if (questionError || !currentQuestion) {
      console.error("PATCH - Question fetch error:", {
        questionId,
        error: questionError,
        message: questionError?.message,
        details: questionError?.details,
        hint: questionError?.hint,
        code: questionError?.code,
      });
      return NextResponse.json(
        {
          error: "Question not found",
          details: questionError?.message,
          questionId,
        },
        { status: 404 }
      );
    }

    // NEW PERMISSION SYSTEM
    // 1. Admins can edit anything, anytime
    // 2. Creators can only edit their own draft/rejected questions
    // 3. Reviewers can only make patch edits to assigned pending_review questions
    // 4. Nobody (except admins) can edit approved/published questions

    const isAdmin = userRole === "admin";
    const isCreator = userRole === "creator";
    const isReviewer = userRole === "reviewer";
    const isQuestionCreator = currentQuestion.created_by === userId;
    const isAssignedReviewer = currentQuestion.reviewer_id === userId;

    // Check if question is published
    if (currentQuestion.status === "published") {
      // Allow patch edits for creators and reviewers
      if (isPatchEdit) {
        // Creators can make patch edits to their own published questions
        if (isCreator && isQuestionCreator) {
          console.log("PATCH - Creator making patch edit to own published question");
        }
        // Reviewers can make patch edits to any published question
        else if (isReviewer) {
          console.log("PATCH - Reviewer making patch edit to published question");
        }
        // Admins can always edit
        else if (isAdmin) {
          console.log("PATCH - Admin making patch edit to published question");
        } else {
          return NextResponse.json(
            {
              error: "Insufficient permissions for patch edit",
              message:
                "Only creators (of their own questions) and reviewers can make patch edits to published questions.",
            },
            { status: 403 }
          );
        }
      } else {
        // Non-patch edits (minor/major) require admin or creator with review
        if (!isAdmin && !isCreator) {
          return NextResponse.json(
            {
              error: "Cannot edit published questions",
              message:
                "Only admins and creators can make non-patch edits to published questions. Non-patch edits require review.",
            },
            { status: 403 }
          );
        }
        // For creators making non-patch edits, they need to go through review
        if (isCreator && isQuestionCreator && !isAdmin) {
          // This will be handled by changing status to pending_review
          console.log(
            "PATCH - Creator making minor/major edit to published question (will require review)"
          );
        }
      }
    }
    // Check if question is pending review
    else if (currentQuestion.status === "pending_review") {
      // Reviewers can make patch edits to assigned questions
      if (isReviewer && isAssignedReviewer) {
        // Reviewer can make patch-level edits (typos, rewording, etc.)
        // This is allowed and will be tracked via updated_by
        console.log("PATCH - Reviewer making patch edit to assigned question");
      }
      // Creators can edit their own pending questions (before review starts)
      else if (isCreator && isQuestionCreator) {
        console.log("PATCH - Creator editing own pending question");
      }
      // Admins can always edit
      else if (isAdmin) {
        console.log("PATCH - Admin editing pending question");
      } else {
        return NextResponse.json(
          {
            error: "Insufficient permissions",
            message: "You can only edit questions you created or are assigned to review.",
          },
          { status: 403 }
        );
      }
    }
    // For draft/rejected questions
    else {
      // Creators can edit their own draft/rejected questions
      if (isCreator && isQuestionCreator) {
        console.log("PATCH - Creator editing own draft/rejected question");
      }
      // Admins can edit any draft/rejected question
      else if (isAdmin) {
        console.log("PATCH - Admin editing draft/rejected question");
      } else {
        return NextResponse.json(
          {
            error: "Insufficient permissions",
            message: "You can only edit questions you created.",
          },
          { status: 403 }
        );
      }
    }

    // Start transaction-like operations
    try {
      // Update the main question data - only include valid question table fields
      // For published questions with minor/major edits, change status to pending_review
      let statusToSet = questionData.status;
      const reviewerToSet = reviewerId || currentQuestion.reviewer_id;
      if (
        currentQuestion.status === "published" &&
        !isPatchEdit &&
        updateType &&
        ["minor", "major"].includes(updateType)
      ) {
        // Check if there's a reviewer (either newly assigned or existing)
        if (!reviewerToSet) {
          // No reviewer assigned - cannot move to pending_review due to constraint
          // The question will remain published, and admin must manually assign a reviewer
          // and change status to pending_review if they want it reviewed
          console.log(
            `PATCH - Cannot change status to pending_review for ${updateType} edit: no reviewer assigned. Question will remain published.`
          );
          throw new Error(
            `This ${updateType} edit requires review, but no reviewer is assigned. Please either: (1) Make only patch-level edits (typos, minor fixes), or (2) Have an admin assign a reviewer first using the 'Submit for Review' option.`
          );
        }
        statusToSet = "pending_review";
        // Use the assigned reviewer (newly assigned or existing)
        console.log(
          `PATCH - Changing status from published to pending_review for ${updateType} edit, using reviewer: ${reviewerToSet}`
        );
      }

      // Validate status change to pending_review requires a reviewer
      // Allow updating questions that are ALREADY pending_review (they already have a reviewer)
      // But prevent NEW transitions to pending_review without a reviewer
      const finalStatus = statusToSet || questionData.status;
      const isChangingToPendingReview =
        finalStatus === "pending_review" && currentQuestion.status !== "pending_review";

      if (isChangingToPendingReview && !reviewerToSet && !questionData.reviewer_id) {
        throw new Error(
          "Cannot set status to pending_review without a reviewer. Please use the 'Submit for Review' button to assign a reviewer and change the status."
        );
      }

      // Determine if the final status will be pending_review
      const willBePendingReview = finalStatus === "pending_review";

      // Check if this is the first time publishing (transition to published status)
      const isFirstTimePublishing =
        statusToSet === "published" && currentQuestion.status !== "published";

      const validQuestionFields = {
        ...(questionData.title && { title: questionData.title }),
        ...(questionData.stem && { stem: questionData.stem }),
        ...(questionData.difficulty && { difficulty: questionData.difficulty }),
        ...(questionData.teaching_point && { teaching_point: questionData.teaching_point }),
        ...(questionData.question_references !== undefined && {
          question_references: questionData.question_references,
        }),
        ...(questionData.lesson !== undefined && { lesson: questionData.lesson }),
        ...(questionData.topic !== undefined && { topic: questionData.topic }),
        ...(questionData.anki_card_id !== undefined && { anki_card_id: questionData.anki_card_id }),
        ...(questionData.anki_deck_name !== undefined && {
          anki_deck_name: questionData.anki_deck_name,
        }),
        ...(statusToSet && { status: statusToSet }),
        ...(questionData.question_set_id !== undefined && {
          question_set_id: questionData.question_set_id,
        }),
        // Initialize version to 1.0.0 when publishing for the first time
        ...(isFirstTimePublishing && {
          version_major: 1,
          version_minor: 0,
          version_patch: 0,
        }),
        // Ensure reviewer_id is always set when status is or will be pending_review (required by constraint)
        ...(willBePendingReview &&
          (reviewerToSet || questionData.reviewer_id) && {
            reviewer_id: reviewerToSet || questionData.reviewer_id,
          }),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await adminClient
        .from("questions")
        .update(validQuestionFields)
        .eq("id", questionId);

      if (updateError) {
        throw new Error(`Failed to update question: ${updateError.message}`);
      }

      // Update answer options if provided
      if (answerOptions) {
        console.log("Updating answer options...");

        // Get existing options for this question
        const { data: existingOptions, error: fetchError } = await adminClient
          .from("question_options")
          .select("id, text, is_correct, explanation, order_index")
          .eq("question_id", questionId);

        if (fetchError) {
          console.error("Error fetching existing options:", fetchError);
          throw new Error(`Failed to fetch existing options: ${fetchError.message}`);
        }

        // Get option IDs that are referenced by quiz attempts
        const { data: referencedOptions, error: referencedError } = await adminClient
          .from("quiz_attempts")
          .select("selected_answer_id")
          .not("selected_answer_id", "is", null)
          .in("selected_answer_id", existingOptions?.map((opt) => opt.id) || []);

        if (referencedError) {
          console.error("Error checking referenced options:", referencedError);
          throw new Error(`Failed to check referenced options: ${referencedError.message}`);
        }

        const referencedOptionIds = new Set(
          referencedOptions?.map((ref) => ref.selected_answer_id) || []
        );
        console.log("Referenced option IDs:", Array.from(referencedOptionIds));

        // Process incoming options
        const incomingOptionIds = new Set();
        const optionsToUpdate = [];
        const optionsToInsert = [];

        for (let index = 0; index < answerOptions.length; index++) {
          const option = answerOptions[index];
          const optionData = {
            text: option.text,
            is_correct: option.is_correct,
            explanation: option.explanation || null,
            order_index: index,
          };

          if (option.id) {
            // This is an existing option - update it
            incomingOptionIds.add(option.id);
            optionsToUpdate.push({
              id: option.id,
              ...optionData,
            });
          } else {
            // This is a new option - insert it
            optionsToInsert.push({
              question_id: questionId,
              ...optionData,
            });
          }
        }

        // Update existing options
        for (const option of optionsToUpdate) {
          const { error: updateError } = await adminClient
            .from("question_options")
            .update({
              text: option.text,
              is_correct: option.is_correct,
              explanation: option.explanation,
              order_index: option.order_index,
            })
            .eq("id", option.id);

          if (updateError) {
            console.error("Error updating option:", updateError);
            throw new Error(`Failed to update option: ${updateError.message}`);
          }
        }

        // Insert new options
        if (optionsToInsert.length > 0) {
          const { error: insertError } = await adminClient
            .from("question_options")
            .insert(optionsToInsert);

          if (insertError) {
            console.error("Error inserting new options:", insertError);
            throw new Error(`Failed to insert new options: ${insertError.message}`);
          }
        }

        // Delete options that are no longer needed (but only if not referenced)
        const existingOptionIds = new Set(existingOptions?.map((opt) => opt.id) || []);
        const optionsToDelete = Array.from(existingOptionIds).filter(
          (id) => !incomingOptionIds.has(id) && !referencedOptionIds.has(id)
        );

        if (optionsToDelete.length > 0) {
          const { error: deleteError } = await adminClient
            .from("question_options")
            .delete()
            .in("id", optionsToDelete);

          if (deleteError) {
            console.error("Error deleting unreferenced options:", deleteError);
            throw new Error(`Failed to delete unreferenced options: ${deleteError.message}`);
          }
          console.log(`Deleted ${optionsToDelete.length} unreferenced options`);
        }

        // Log warning for options that couldn't be deleted due to references
        const referencedButNotIncoming = Array.from(existingOptionIds).filter(
          (id) => !incomingOptionIds.has(id) && referencedOptionIds.has(id)
        );
        if (referencedButNotIncoming.length > 0) {
          console.warn(
            `Warning: ${referencedButNotIncoming.length} options could not be deleted because they are referenced by quiz attempts:`,
            referencedButNotIncoming
          );
        }

        console.log("Answer options updated successfully");
      } else {
        console.log("No answer options to update");
      }

      // Update question images if provided
      if (questionImages) {
        // Delete existing question images
        await adminClient.from("question_images").delete().eq("question_id", questionId);

        // Insert new question images
        if (questionImages.length > 0) {
          const { error: imagesError } = await adminClient.from("question_images").insert(
            questionImages.map(
              (img: { image_id: string; question_section: string }, index: number) => ({
                question_id: questionId,
                image_id: img.image_id,
                question_section: img.question_section,
                order_index: index,
              })
            )
          );

          if (imagesError) {
            throw new Error(`Failed to update question images: ${imagesError.message}`);
          }
        }
      }

      // Update question tags if provided
      if (tagIds !== undefined) {
        console.log("Updating tags...");

        // Delete existing tags
        const { error: deleteTagsError } = await adminClient
          .from("question_tags")
          .delete()
          .eq("question_id", questionId);

        if (deleteTagsError) {
          console.error("Error deleting existing tags:", deleteTagsError);
          throw new Error(`Failed to delete existing tags: ${deleteTagsError.message}`);
        }

        // Insert new tags
        if (tagIds && tagIds.length > 0) {
          // Filter out any null/undefined tag IDs
          const validTagIds = tagIds.filter(
            (tagId: string | null | undefined) =>
              tagId !== null &&
              tagId !== undefined &&
              typeof tagId === "string" &&
              tagId.trim() !== ""
          );

          console.log("Original tagIds:", tagIds);
          console.log("Filtered validTagIds:", validTagIds);

          if (validTagIds.length > 0) {
            const { error: tagsError } = await adminClient.from("question_tags").insert(
              validTagIds.map((tagId: string) => ({
                question_id: questionId,
                tag_id: tagId,
              }))
            );

            if (tagsError) {
              console.error("Tags update error:", tagsError);
              throw new Error(
                `Failed to update question tags: ${tagsError.message || JSON.stringify(tagsError)}`
              );
            }
          }
        }
      }

      // Update category if provided
      if (categoryId !== undefined) {
        const { error: categoryError } = await adminClient
          .from("questions")
          .update({ category_id: categoryId || null })
          .eq("id", questionId);

        if (categoryError) {
          throw new Error(`Failed to update question category: ${categoryError.message}`);
        }
      }

      // Handle versioning for published questions
      let versionId = null;

      console.log("VERSIONING LOGIC - Status check:", {
        currentStatus: currentQuestion.status,
        isFirstTimePublishing,
        isPatchEdit,
        updateType,
        changeSummary,
        patchEditReason,
      });

      // Create initial version entry when publishing for the first time
      if (isFirstTimePublishing) {
        console.log("VERSIONING - Creating initial version 1.0.0");
        const { data: newVersionId, error: versionError} = await adminClient
          .from("question_versions")
          .insert({
            question_id: questionId,
            version_major: 1,
            version_minor: 0,
            version_patch: 0,
            update_type: "initial",
            change_summary: "Initial publication",
            question_data: {
              title: questionData?.title || currentQuestion.title,
              stem: questionData?.stem || currentQuestion.stem,
              difficulty: questionData?.difficulty || currentQuestion.difficulty,
              teaching_point: questionData?.teaching_point || currentQuestion.teaching_point,
              question_references: questionData?.question_references || currentQuestion.question_references,
              question_set_id: questionData?.question_set_id || currentQuestion.question_set_id,
              category_id: categoryId || currentQuestion.category_id,
              tag_ids: tagIds || [],
              question_options: answerOptions || [],
              question_images: questionImages || [],
              lesson: questionData?.lesson || currentQuestion.lesson,
              topic: questionData?.topic || currentQuestion.topic,
            },
            changed_by: userId,
          })
          .select("id")
          .single();

        if (versionError) {
          console.error("Error creating initial version history:", versionError);
          // Continue without version history rather than failing the entire update
        } else {
          versionId = newVersionId?.id;
        }
      }
      // Handle versioning for already published questions
      else if (currentQuestion.status === "published") {
        console.log("VERSIONING - Question is published, checking edit type");
        if (isPatchEdit) {
          console.log("VERSIONING - Patch edit detected, creating version entry");
          // For patch edits, increment patch version only
          const newVersionPatch = (currentQuestion.version_patch || 0) + 1;

          const { error: versionUpdateError } = await adminClient
            .from("questions")
            .update({
              version_patch: newVersionPatch,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", questionId);

          if (versionUpdateError) {
            console.error("Error updating patch version:", versionUpdateError);
            throw new Error(`Failed to update patch version: ${versionUpdateError.message}`);
          }

          // Create version history entry for patch edit
          const { data: newVersionId, error: versionError } = await adminClient
            .from("question_versions")
            .insert({
              question_id: questionId,
              version_major: currentQuestion.version_major || 1,
              version_minor: currentQuestion.version_minor || 0,
              version_patch: newVersionPatch,
              update_type: "patch",
              change_summary: patchEditReason || changeSummary || "Patch edit",
              question_data: {
                title: questionData?.title,
                stem: questionData?.stem,
                difficulty: questionData?.difficulty,
                teaching_point: questionData?.teaching_point,
                question_references: questionData?.question_references,
                question_set_id: questionData?.question_set_id,
                category_id: categoryId,
                tag_ids: tagIds || [],
                question_options: answerOptions || [],
                question_images: questionImages || [],
                lesson: questionData?.lesson,
                topic: questionData?.topic,
              },
              changed_by: userId,
            })
            .select("id")
            .single();

          if (versionError) {
            console.error("❌ VERSIONING ERROR - Failed to create patch version:", versionError);
            console.error("Version data attempted:", {
              question_id: questionId,
              version_major: currentQuestion.version_major || 1,
              version_minor: currentQuestion.version_minor || 0,
              version_patch: newVersionPatch,
            });
            // Continue without version history rather than failing the entire update
          } else {
            console.log("✅ VERSIONING SUCCESS - Created patch version:", newVersionId?.id);
            versionId = newVersionId?.id;
          }
        } else if (updateType && ["minor", "major"].includes(updateType)) {
          console.log(`VERSIONING - ${updateType} edit detected, creating version entry`);
          // For minor/major edits, increment appropriate version numbers
          let newVersionMajor = currentQuestion.version_major || 1;
          let newVersionMinor = currentQuestion.version_minor || 0;
          const newVersionPatch = 0;

          if (updateType === "minor") {
            newVersionMinor += 1;
          } else if (updateType === "major") {
            newVersionMajor += 1;
            newVersionMinor = 0;
          }

          const { error: versionUpdateError } = await adminClient
            .from("questions")
            .update({
              version_major: newVersionMajor,
              version_minor: newVersionMinor,
              version_patch: newVersionPatch,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", questionId);

          if (versionUpdateError) {
            console.error("Error updating version:", versionUpdateError);
            throw new Error(`Failed to update version: ${versionUpdateError.message}`);
          }

          // Create version history entry for minor/major edit
          const { data: newVersionId, error: versionError } = await adminClient
            .from("question_versions")
            .insert({
              question_id: questionId,
              version_major: newVersionMajor,
              version_minor: newVersionMinor,
              version_patch: newVersionPatch,
              update_type: updateType as "minor" | "major",
              change_summary: changeSummary || `${updateType} update`,
              question_data: {
                title: questionData?.title,
                stem: questionData?.stem,
                difficulty: questionData?.difficulty,
                teaching_point: questionData?.teaching_point,
                question_references: questionData?.question_references,
                question_set_id: questionData?.question_set_id,
                category_id: categoryId,
                tag_ids: tagIds || [],
                question_options: answerOptions || [],
                question_images: questionImages || [],
                lesson: questionData?.lesson,
                topic: questionData?.topic,
              },
              changed_by: userId,
            })
            .select("id")
            .single();

          if (versionError) {
            console.error(`❌ VERSIONING ERROR - Failed to create ${updateType} version:`, versionError);
            console.error("Version data attempted:", {
              question_id: questionId,
              version_major: newVersionMajor,
              version_minor: newVersionMinor,
              version_patch: newVersionPatch,
            });
            // Continue without version history rather than failing the entire update
          } else {
            console.log(`✅ VERSIONING SUCCESS - Created ${updateType} version:`, newVersionId?.id);
            versionId = newVersionId?.id;
          }
        } else {
          console.log("⚠️ VERSIONING SKIPPED - No isPatchEdit or updateType set:", {
            isPatchEdit,
            updateType,
          });
        }
      } else {
        console.log("⚠️ VERSIONING SKIPPED - Question not published, status:", currentQuestion.status);
      }

      // Get updated question data
      const { data: updatedQuestion, error: fetchError } = await adminClient
        .from("questions")
        .select("id, version_major, version_minor, version_patch, updated_at, status")
        .eq("id", questionId)
        .single();

      if (fetchError) {
        console.error("Error fetching updated question:", fetchError);
        return NextResponse.json(
          { error: "Question updated but failed to fetch updated data" },
          { status: 500 }
        );
      }

      // Revalidate caches to update all admin pages
      revalidateQuestions({ questionId, includeDashboard: true });

      const versionString = formatVersion(
        updatedQuestion.version_major,
        updatedQuestion.version_minor,
        updatedQuestion.version_patch,
        false
      );

      return NextResponse.json({
        success: true,
        question: updatedQuestion,
        versionId,
        message: versionId
          ? `Question updated to version ${versionString}`
          : "Question updated successfully",
      });
    } catch (error) {
      console.error("Error during question update:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to update question" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in question update API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
