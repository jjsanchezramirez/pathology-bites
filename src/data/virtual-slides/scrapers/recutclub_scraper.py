import json
import time
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from urllib.parse import urljoin

class RecutClubScraper:
    def __init__(self, headless=False, debug=False):
        """Initialize the scraper with Chrome WebDriver"""
        self.base_url = "https://recutclub.com"
        self.scraped_data = []
        
        # Setup logging
        log_level = logging.DEBUG if debug else logging.INFO
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Configure Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, 20)
        
        self.logger.info("RecutClub Scraper initialized")

    def debug_page_state(self, prefix="debug"):
        """Save screenshot and page source for debugging"""
        try:
            # Save screenshot
            screenshot_path = f"{prefix}_screenshot.png"
            self.driver.save_screenshot(screenshot_path)
            self.logger.info(f"Screenshot saved to {screenshot_path}")
            
            # Save page source
            source_path = f"{prefix}_page_source.html"
            with open(source_path, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.logger.info(f"Page source saved to {source_path}")
            
            # Log current URL
            self.logger.info(f"Current URL: {self.driver.current_url}")
            
            # Log what forms are visible
            forms = self.driver.find_elements(By.TAG_NAME, "form")
            self.logger.info(f"Found {len(forms)} forms on page")
            
            for i, form in enumerate(forms):
                if form.is_displayed():
                    form_id = form.get_attribute('id')
                    form_class = form.get_attribute('class')
                    self.logger.info(f"  Form {i+1}: id='{form_id}' class='{form_class}' visible=True")
                    
                    # Check for email inputs in this form
                    email_inputs = form.find_elements(By.CSS_SELECTOR, "input[type='email'], input#inputEmail")
                    if email_inputs:
                        self.logger.info(f"    Found {len(email_inputs)} email inputs")
                        
        except Exception as e:
            self.logger.error(f"Debug failed: {str(e)}")

    def login(self, email, password):
        """Login to RecutClub with multiple strategies"""
        try:
            self.logger.info(f"Navigating to {self.base_url}")
            self.driver.get(self.base_url)
            time.sleep(5)  # Give more time for page load
            
            # Debug the initial page state
            self.debug_page_state("initial_page")
            
            # Check if already logged in
            try:
                user_menu = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Juan Jose')]")
                if user_menu:
                    self.logger.info("Already logged in!")
                    return True
            except NoSuchElementException:
                pass
            
            self.logger.info("Not logged in, attempting login...")
            
            # Strategy 1: Try the main center login form first
            success = self._try_main_login_form(email, password)
            if success:
                return True
            
            # Strategy 2: Try the dropdown login form
            success = self._try_dropdown_login_form(email, password)
            if success:
                return True
            
            # Strategy 3: Generic form finder
            success = self._try_generic_login_form(email, password)
            if success:
                return True
            
            # If all failed, debug the final state
            self.debug_page_state("login_failed")
            self.logger.error("All login strategies failed")
            return False
                
        except Exception as e:
            self.logger.error(f"Login failed with exception: {str(e)}")
            self.debug_page_state("login_exception")
            return False

    def _try_main_login_form(self, email, password):
        """Try to login using the main center form"""
        try:
            self.logger.info("Strategy 1: Trying main center login form...")
            
            # Look for the main login form in the center
            email_field = None
            password_field = None
            submit_button = None
            
            # Wait a bit and try to find the form
            time.sleep(2)
            
            # Try multiple selectors for the main form
            form_selectors = [
                "main form#login-nav",
                "form#login-nav",
                ".cover-container form",
                ".inner.cover form"
            ]
            
            form_element = None
            for selector in form_selectors:
                try:
                    form_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if form_element.is_displayed():
                        self.logger.info(f"Found main form with selector: {selector}")
                        break
                except NoSuchElementException:
                    continue
            
            if form_element:
                # Find fields within the form
                email_field = form_element.find_element(By.ID, "inputEmail")
                password_field = form_element.find_element(By.ID, "inputPassword")
                submit_button = form_element.find_element(By.CSS_SELECTOR, "button[type='submit']")
                
                # Fill and submit
                email_field.clear()
                email_field.send_keys(email)
                password_field.clear()
                password_field.send_keys(password)
                
                self.logger.info("Submitting main form...")
                submit_button.click()
                
                return self._wait_for_login_success()
            
            return False
            
        except Exception as e:
            self.logger.warning(f"Main form login failed: {str(e)}")
            return False

    def _try_dropdown_login_form(self, email, password):
        """Try to login using the dropdown form"""
        try:
            self.logger.info("Strategy 2: Trying dropdown login form...")
            
            # Find and click the login dropdown
            login_dropdown = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Login')]")
            login_dropdown.click()
            time.sleep(2)
            
            # Find the dropdown form
            dropdown_form = self.driver.find_element(By.CSS_SELECTOR, "#login-dp form")
            
            email_field = dropdown_form.find_element(By.ID, "inputEmail")
            password_field = dropdown_form.find_element(By.ID, "inputPassword")
            submit_button = dropdown_form.find_element(By.CSS_SELECTOR, "button[type='submit']")
            
            # Fill and submit
            email_field.clear()
            email_field.send_keys(email)
            password_field.clear()
            password_field.send_keys(password)
            
            self.logger.info("Submitting dropdown form...")
            submit_button.click()
            
            return self._wait_for_login_success()
            
        except Exception as e:
            self.logger.warning(f"Dropdown form login failed: {str(e)}")
            return False

    def _try_generic_login_form(self, email, password):
        """Try to find any login form generically"""
        try:
            self.logger.info("Strategy 3: Trying generic form finder...")
            
            # Find any email input
            email_inputs = self.driver.find_elements(By.CSS_SELECTOR, "input[type='email'], input#inputEmail, input[name='inputEmail']")
            
            for email_field in email_inputs:
                if email_field.is_displayed():
                    try:
                        # Find corresponding password field
                        form = email_field.find_element(By.XPATH, "./ancestor::form[1]")
                        password_field = form.find_element(By.CSS_SELECTOR, "input[type='password']")
                        submit_button = form.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
                        
                        # Fill and submit
                        email_field.clear()
                        email_field.send_keys(email)
                        password_field.clear()
                        password_field.send_keys(password)
                        
                        self.logger.info("Submitting generic form...")
                        submit_button.click()
                        
                        return self._wait_for_login_success()
                        
                    except Exception as inner_e:
                        self.logger.warning(f"Generic form attempt failed: {str(inner_e)}")
                        continue
            
            return False
            
        except Exception as e:
            self.logger.warning(f"Generic form login failed: {str(e)}")
            return False

    def _wait_for_login_success(self):
        """Wait for login to be successful"""
        try:
            self.logger.info("Waiting for login to complete...")
            
            # Wait for one of these success indicators
            success_indicators = [
                (By.ID, "topic_selection"),
                (By.XPATH, "//a[contains(text(), 'Juan Jose')]"),
                (By.XPATH, "//a[contains(text(), 'My Cases')]"),
                (By.XPATH, "//a[contains(text(), 'Log Out')]"),
                (By.CSS_SELECTOR, ".dropdown-toggle b")
            ]
            
            for indicator in success_indicators:
                try:
                    element = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located(indicator)
                    )
                    if element:
                        self.logger.info(f"Login successful! Found indicator: {indicator}")
                        time.sleep(3)  # Let page fully load
                        return True
                except TimeoutException:
                    continue
            
            # Also check if URL changed (might redirect after login)
            current_url = self.driver.current_url
            if current_url != self.base_url and "login" not in current_url.lower():
                self.logger.info("Login successful! URL changed indicating success")
                return True
            
            self.logger.warning("No login success indicators found")
            return False
            
        except Exception as e:
            self.logger.error(f"Error waiting for login success: {str(e)}")
            return False

    def get_categories(self):
        """Get all available categories from the topic dropdown"""
        try:
            self.logger.info("Getting available categories...")
            
            # Make sure we're on the main study page
            current_url = self.driver.current_url
            if "study" not in current_url.lower() and self.base_url in current_url:
                # We might be on the home page, the categories should still be visible
                pass
            
            # Find the topic selection dropdown
            topic_select = self.wait.until(
                EC.presence_of_element_located((By.ID, "topic_selection"))
            )
            
            select = Select(topic_select)
            categories = []
            
            for option in select.options:
                value = option.get_attribute('value')
                text = option.text.strip()
                
                # Skip empty options
                if value and text and value != "":
                    categories.append({
                        'name': text,
                        'value': value
                    })
            
            self.logger.info(f"Found {len(categories)} categories: {[cat['name'] for cat in categories]}")
            return categories
            
        except Exception as e:
            self.logger.error(f"Failed to get categories: {str(e)}")
            return []

    def select_category(self, category_value):
        """Select a specific category"""
        try:
            self.logger.info(f"Selecting category: {category_value}")
            
            topic_select = self.driver.find_element(By.ID, "topic_selection")
            select = Select(topic_select)
            select.select_by_value(category_value)
            
            # Wait for conferences to load
            time.sleep(3)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to select category {category_value}: {str(e)}")
            return False

    def get_conferences(self):
        """Get all conferences for the currently selected category"""
        try:
            self.logger.info("Getting conferences for selected category...")
            
            conference_select = self.wait.until(
                EC.presence_of_element_located((By.ID, "conference_selection"))
            )
            
            select = Select(conference_select)
            conferences = []
            
            for option in select.options:
                value = option.get_attribute('value')
                text = option.text.strip()
                data_merged = option.get_attribute('data-merged')
                
                if value and text and value != "":
                    conferences.append({
                        'name': text,
                        'value': value,
                        'data_merged': data_merged
                    })
            
            self.logger.info(f"Found {len(conferences)} conferences")
            return conferences
            
        except Exception as e:
            self.logger.error(f"Failed to get conferences: {str(e)}")
            return []

    def select_conference(self, conference_value):
        """Select a specific conference"""
        try:
            self.logger.info(f"Selecting conference: {conference_value}")
            
            conference_select = self.driver.find_element(By.ID, "conference_selection")
            select = Select(conference_select)
            select.select_by_value(conference_value)
            
            # Wait for cases to load
            time.sleep(4)
            
            # Wait for the cases container to be present
            self.wait.until(
                EC.presence_of_element_located((By.ID, "casesFromConference"))
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to select conference {conference_value}: {str(e)}")
            return False

    def extract_case_data(self, card_element, category_name, conference_name):
        """Extract data from a single case card by clicking tabs"""
        case_data = {
            'category': category_name,
            'conference': conference_name,
            'case_title': '',
            'case_url': '',
            'image_url': '',
            'history': '',
            'diagnosis': ''
        }
        
        try:
            # Extract case title
            try:
                title_element = card_element.find_element(By.CSS_SELECTOR, ".card-title")
                case_data['case_title'] = title_element.text.strip()
            except NoSuchElementException:
                case_data['case_title'] = "Unknown Case"
            
            # Extract case URL and image URL
            try:
                link_element = card_element.find_element(By.CSS_SELECTOR, "a[href*='caseViewer']")
                case_url = link_element.get_attribute('href')
                case_data['case_url'] = urljoin(self.base_url, case_url)
                
                # Get image URL from the same link
                img_element = link_element.find_element(By.TAG_NAME, "img")
                case_data['image_url'] = img_element.get_attribute('src')
            except NoSuchElementException:
                pass
            
            # Extract history and diagnosis by clicking tabs
            self._extract_tab_content_by_clicking(card_element, case_data)
            
            return case_data
            
        except Exception as e:
            self.logger.error(f"Error extracting case data for {case_data['case_title']}: {str(e)}")
            return case_data

    def _extract_tab_content_by_clicking(self, card_element, case_data):
        """Extract tab content by clicking each tab - WITH CONTENT WAIT"""
        try:
            # Find all tab navigation links
            nav_links = card_element.find_elements(By.CSS_SELECTOR, ".nav-pills .nav-link")
            
            if not nav_links:
                print(f"      ❌ No nav links found for {case_data['case_title']}")
                return
            
            print(f"      🔗 Found {len(nav_links)} nav links for {case_data['case_title']}")
            
            # Click each tab and extract content
            for i, link in enumerate(nav_links):
                try:
                    link_text = link.text.strip().lower()
                    print(f"        Tab {i+1}: '{link_text}'")
                    
                    # Click the tab to make it active
                    self.driver.execute_script("arguments[0].click();", link)
                    
                    # Wait for tab to become active AND content to load
                    content = self._wait_for_tab_content(card_element, link_text)
                    
                    if content:
                        print(f"        Content: '{content[:50]}...' (length: {len(content)})")
                        
                        # Save content based on tab text
                        if 'history' in link_text:
                            case_data['history'] = content
                            print(f"        ✅ SAVED as history")
                        elif 'diagnosis' in link_text:
                            case_data['diagnosis'] = content
                            print(f"        ✅ SAVED as diagnosis")
                        else:
                            print(f"        ⚠️ Tab '{link_text}' not saved (not history/diagnosis)")
                    else:
                        print(f"        ❌ No content found for '{link_text}'")
                        
                except Exception as tab_error:
                    print(f"        ❌ Error processing tab {i+1}: {tab_error}")
                    continue
                    
        except Exception as e:
            print(f"      ❌ Tab extraction failed for {case_data['case_title']}: {e}")
            
        # Show final result for this case
        has_history = "✅" if case_data['history'] else "❌"
        has_diagnosis = "✅" if case_data['diagnosis'] else "❌"
        print(f"      📊 Final: History {has_history} | Diagnosis {has_diagnosis}")

    def _wait_for_tab_content(self, card_element, tab_name):
        """Wait for tab content to actually load after clicking"""
        max_attempts = 10  # Try for up to 5 seconds
        for attempt in range(max_attempts):
            try:
                # Find the currently active tab pane
                active_pane = card_element.find_element(By.CSS_SELECTOR, ".tab-pane.active")
                panel_body = active_pane.find_element(By.CSS_SELECTOR, ".panel-body")
                content = panel_body.text.strip()
                
                # If we got content, return it
                if content:
                    return content
                    
                # If no content yet, wait a bit and try again
                time.sleep(0.5)
                
            except Exception as e:
                time.sleep(0.5)
                continue
        
        # If we get here, content never loaded
        print(f"          ⚠️ Content never loaded for {tab_name} after {max_attempts} attempts")
        return ""

    def scrape_conference_cases(self, category_name, conference_name):
        """Scrape all cases from the currently selected conference"""
        try:
            self.logger.info(f"Scraping cases for {category_name} - {conference_name}")
            
            # Find the cases container
            cases_container = self.wait.until(
                EC.presence_of_element_located((By.ID, "casesFromConference"))
            )
            
            # Find all case cards
            case_cards = cases_container.find_elements(By.CSS_SELECTOR, ".card")
            
            if not case_cards:
                self.logger.warning(f"No cases found for {conference_name}")
                return []
            
            self.logger.info(f"Found {len(case_cards)} cases in {conference_name}")
            
            conference_cases = []
            for i, card in enumerate(case_cards):
                try:
                    case_data = self.extract_case_data(card, category_name, conference_name)
                    if case_data['case_title']:  # Only add if we got some data
                        conference_cases.append(case_data)
                        
                        # Show what we extracted
                        has_history = "H" if case_data['history'] else "-"
                        has_diagnosis = "D" if case_data['diagnosis'] else "-"
                        self.logger.info(f"      Case {i+1}/{len(case_cards)}: {case_data['case_title']} [{has_history}{has_diagnosis}]")
                    else:
                        self.logger.warning(f"      Case {i+1}/{len(case_cards)}: Failed to extract")
                        
                except Exception as e:
                    self.logger.error(f"Error processing case {i+1}: {str(e)}")
                    continue
            
            return conference_cases
            
        except Exception as e:
            self.logger.error(f"Failed to scrape cases: {str(e)}")
            return []

    def is_logged_in(self):
        """Check if user is already logged in"""
        try:
            # Look for user-specific elements that indicate login
            success_indicators = [
                (By.ID, "topic_selection"),
                (By.XPATH, "//a[contains(text(), 'Juan Jose')]"),
                (By.XPATH, "//a[contains(text(), 'My Cases')]"),
                (By.XPATH, "//a[contains(text(), 'Log Out')]")
            ]
            
            for indicator in success_indicators:
                try:
                    element = self.driver.find_element(*indicator)
                    if element and element.is_displayed():
                        self.logger.info(f"Already logged in - found indicator: {indicator}")
                        return True
                except NoSuchElementException:
                    continue
            
            return False
            
        except Exception as e:
            self.logger.warning(f"Error checking login status: {str(e)}")
            return False

    def scrape_all(self, email, password, skip_login=False):
        """Main scraping function"""
        try:
            # Login only if not already logged in
            if not skip_login and not self.is_logged_in():
                if not self.login(email, password):
                    self.logger.error("Failed to login. Aborting.")
                    return False
            elif self.is_logged_in():
                self.logger.info("Already logged in, skipping login step")
            
            # Get all categories
            categories = self.get_categories()
            if not categories:
                self.logger.error("No categories found. Aborting.")
                return False
            
            total_cases = 0
            
            for category in categories:
                self.logger.info(f"\n{'='*50}")
                self.logger.info(f"Processing Category: {category['name']}")
                self.logger.info(f"{'='*50}")
                
                # Select category
                if not self.select_category(category['value']):
                    continue
                
                # Get conferences for this category
                conferences = self.get_conferences()
                if not conferences:
                    self.logger.warning(f"No conferences found for {category['name']}")
                    continue
                
                for conference in conferences:
                    self.logger.info(f"\nProcessing Conference: {conference['name']}")
                    
                    # Select conference
                    if not self.select_conference(conference['value']):
                        continue
                    
                    # Scrape cases
                    cases = self.scrape_conference_cases(category['name'], conference['name'])
                    self.scraped_data.extend(cases)
                    total_cases += len(cases)
                    
                    self.logger.info(f"Added {len(cases)} cases. Total: {total_cases}")
                    
                    # Be nice to the server
                    time.sleep(2)
            
            self.logger.info(f"\nScraping completed! Total cases: {total_cases}")
            return True
            
        except Exception as e:
            self.logger.error(f"Scraping failed: {str(e)}")
            return False

    def save_data(self, filename="recutclub_data.json"):
        """Save scraped data to JSON file"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.scraped_data, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Data saved to {filename}")
            
            # Print summary
            print(f"\n{'='*60}")
            print("SCRAPING SUMMARY")
            print(f"{'='*60}")
            print(f"Total cases scraped: {len(self.scraped_data)}")
            
            # Count by category
            category_counts = {}
            for case in self.scraped_data:
                cat = case['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            print("\nCases by category:")
            for cat, count in sorted(category_counts.items()):
                print(f"  {cat}: {count}")
            
            # Data completeness
            with_history = sum(1 for case in self.scraped_data if case['history'])
            with_diagnosis = sum(1 for case in self.scraped_data if case['diagnosis'])
            with_both = sum(1 for case in self.scraped_data if case['history'] and case['diagnosis'])
            
            print(f"\nData completeness:")
            print(f"  Cases with history: {with_history} ({with_history/len(self.scraped_data)*100:.1f}%)")
            print(f"  Cases with diagnosis: {with_diagnosis} ({with_diagnosis/len(self.scraped_data)*100:.1f}%)")
            print(f"  Cases with both: {with_both} ({with_both/len(self.scraped_data)*100:.1f}%)")
            
            # Show sample cases
            print(f"\nSample cases:")
            for i, case in enumerate(self.scraped_data[:3]):
                print(f"  {i+1}. {case['category']} - {case['case_title']}")
                if case['history']:
                    print(f"     History: {case['history'][:80]}...")
                if case['diagnosis']:
                    print(f"     Diagnosis: {case['diagnosis'][:80]}...")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to save data: {str(e)}")
            return False

    def close(self):
        """Close the browser"""
        if self.driver:
            self.driver.quit()

def main():
    """Main function"""
    # Credentials
    EMAIL = "jjsanchezramirez@gmail.com"
    PASSWORD = "jjsr1989"
    
    print("RecutClub Scraper - Enhanced Version")
    print("=" * 50)
    print("This scraper will:")
    print("1. Login to RecutClub (with multiple strategies)")
    print("2. Get all categories")
    print("3. For each category, get all conferences")
    print("4. For each conference, scrape all cases")
    print("5. Extract: title, URLs, history, diagnosis by clicking tabs")
    print()
    
    # Ask user for preferences
    headless = input("Run in headless mode? (y/n): ").lower().startswith('y')
    debug = input("Enable debug logging? (y/n): ").lower().startswith('y')
    
    # Ask about test mode
    test_mode = input("Run in test mode (first 3 conferences of first 2 categories)? (y/n): ").lower().startswith('y')
    
    print(f"\nStarting scraper...")
    print(f"Headless mode: {headless}")
    print(f"Debug logging: {debug}")
    print(f"Test mode: {test_mode}")
    print()
    
    scraper = RecutClubScraper(headless=headless, debug=debug)
    
    try:
        # First try to login
        print("Attempting login...")
        if scraper.login(EMAIL, PASSWORD):
            print("✅ Login successful!")
            
            if test_mode:
                # Test mode - scrape first 3 conferences of first 2 categories
                categories = scraper.get_categories()
                if categories:
                    print(f"Found {len(categories)} categories. Testing with first 2...")
                    categories = categories[:2]
                    
                    total_cases = 0
                    total_conferences = 0
                    
                    for cat_idx, category in enumerate(categories, 1):
                        print(f"\n{'='*50}")
                        print(f"Testing Category {cat_idx}/2: {category['name']}")
                        print(f"{'='*50}")
                        
                        if scraper.select_category(category['value']):
                            conferences = scraper.get_conferences()
                            print(f"Found {len(conferences)} conferences")
                            
                            if conferences:
                                # Test with first 3 conferences (or all if fewer than 3)
                                test_conferences = conferences[:3]
                                print(f"Will test first {len(test_conferences)} conferences")
                                
                                for conf_idx, conf in enumerate(test_conferences, 1):
                                    print(f"\n  Conference {conf_idx}/{len(test_conferences)}: {conf['name']}")
                                    
                                    if scraper.select_conference(conf['value']):
                                        cases = scraper.scrape_conference_cases(category['name'], conf['name'])
                                        scraper.scraped_data.extend(cases)
                                        total_cases += len(cases)
                                        total_conferences += 1
                                        
                                        # Show extraction results
                                        with_history = sum(1 for c in cases if c['history'])
                                        with_diagnosis = sum(1 for c in cases if c['diagnosis'])
                                        with_both = sum(1 for c in cases if c['history'] and c['diagnosis'])
                                        
                                        print(f"    ✅ Scraped {len(cases)} cases: {with_history}H/{with_diagnosis}D/{with_both}Both")
                                        
                                        # Show sample case if any found
                                        if cases:
                                            sample = cases[0]
                                            print(f"    📝 Sample: {sample['case_title']}")
                                            if sample['history']:
                                                print(f"       History: {sample['history'][:60]}...")
                                            if sample['diagnosis']:
                                                print(f"       Diagnosis: {sample['diagnosis'][:60]}...")
                                    else:
                                        print(f"    ❌ Failed to select conference: {conf['name']}")
                                    
                                    # Be nice to the server between conferences
                                    time.sleep(1)
                            else:
                                print(f"  ⚠️ No conferences found for {category['name']}")
                        else:
                            print(f"❌ Failed to select category: {category['name']}")
                        
                        # Be nice to the server between categories  
                        time.sleep(2)
                    
                    print(f"\n🎉 Test completed!")
                    print(f"📊 Results:")
                    print(f"   - Categories tested: {len(categories)}")
                    print(f"   - Conferences processed: {total_conferences}")
                    print(f"   - Total cases found: {total_cases}")
                    
                    # Show breakdown by category
                    if total_cases > 0:
                        print(f"\n📋 Cases by category:")
                        category_counts = {}
                        for case in scraper.scraped_data:
                            cat = case['category']
                            category_counts[cat] = category_counts.get(cat, 0) + 1
                        
                        for cat, count in category_counts.items():
                            print(f"   - {cat}: {count} cases")
                        
                        # Show data completeness
                        with_history = sum(1 for case in scraper.scraped_data if case['history'])
                        with_diagnosis = sum(1 for case in scraper.scraped_data if case['diagnosis'])
                        with_both = sum(1 for case in scraper.scraped_data if case['history'] and case['diagnosis'])
                        
                        print(f"\n📈 Data completeness:")
                        print(f"   - Cases with history: {with_history}/{total_cases} ({with_history/total_cases*100:.1f}%)")
                        print(f"   - Cases with diagnosis: {with_diagnosis}/{total_cases} ({with_diagnosis/total_cases*100:.1f}%)")
                        print(f"   - Cases with both: {with_both}/{total_cases} ({with_both/total_cases*100:.1f}%)")
                        
                        # Ask to save test data
                        save_choice = input("\nSave test data? (y/n): ").lower().startswith('y')
                        if save_choice:
                            scraper.save_data("test_recutclub_data_v2.json")
                    else:
                        print("❌ No cases found. Check the debug files for more info.")
                        
            else:
                # Full scrape
                if scraper.scrape_all(EMAIL, PASSWORD):
                    scraper.save_data("recutclub_cases.json")
                else:
                    print("❌ Full scraping failed!")
        else:
            print("❌ Login failed!")
            print("Debug files have been saved. Check:")
            print("  - initial_page_screenshot.png")
            print("  - initial_page_page_source.html") 
            print("  - login_failed_screenshot.png")
            print("  - login_failed_page_source.html")
            print("\nThis will help us understand what's happening.")
            
    except KeyboardInterrupt:
        print("\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        scraper.debug_page_state("error")
    finally:
        print("\nClosing browser...")
        scraper.close()
        print("Done!")

if __name__ == "__main__":
    main()