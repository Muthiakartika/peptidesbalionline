"use client";

/**
 * WordPress's comment form under each post, with its markup and texts. The live site has comments
 * switched on but no comments at all (0 on 54 posts). Saving comments is not built yet (open
 * question Q-41: keep comments, and moderate them where?), so sending the form does nothing for now;
 * the browser still checks the required fields, as on the live site.
 */
export function CommentForm({ postId }: { postId: number }) {
  return (
    <div id="comments" className="comments-area">
      <div id="respond" className="comment-respond">
        <h3 id="reply-title" className="comment-reply-title">
          Leave a Reply{" "}
          <small>
            <a rel="nofollow" id="cancel-comment-reply-link" href="#respond" style={{ display: "none" }}>
              Cancel reply
            </a>
          </small>
        </h3>
        <form id="commentform" className="comment-form" onSubmit={(event) => event.preventDefault()}>
          <p className="comment-notes">
            <span id="email-notes">Your email address will not be published.</span>{" "}
            <span className="required-field-message">
              Required fields are marked <span className="required">*</span>
            </span>
          </p>
          <p className="comment-form-comment">
            <label htmlFor="comment">
              Comment <span className="required">*</span>
            </label>{" "}
            <textarea id="comment" name="comment" cols={45} rows={8} maxLength={65525} required />
          </p>
          <p className="comment-form-author">
            <label htmlFor="author">
              Name <span className="required">*</span>
            </label>{" "}
            <input id="author" name="author" type="text" defaultValue="" size={30} maxLength={245} autoComplete="name" required />
          </p>{" "}
          <p className="comment-form-email">
            <label htmlFor="email">
              Email <span className="required">*</span>
            </label>{" "}
            <input id="email" name="email" type="email" defaultValue="" size={30} maxLength={100} aria-describedby="email-notes" autoComplete="email" required />
          </p>{" "}
          <p className="comment-form-url">
            <label htmlFor="url">Website</label> <input id="url" name="url" type="url" defaultValue="" size={30} maxLength={200} autoComplete="url" />
          </p>{" "}
          <p className="comment-form-cookies-consent">
            <input id="wp-comment-cookies-consent" name="wp-comment-cookies-consent" type="checkbox" value="yes" />{" "}
            <label htmlFor="wp-comment-cookies-consent">Save my name, email, and website in this browser for the next time I comment.</label>
          </p>{" "}
          <p className="form-submit">
            <input name="submit" type="submit" id="submit" className="submit" value="Post Comment" /> <input type="hidden" name="comment_post_ID" value={postId} id="comment_post_ID" />{" "}
            <input type="hidden" name="comment_parent" id="comment_parent" value="0" />
          </p>
        </form>
      </div>
    </div>
  );
}
